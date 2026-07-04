/**
 * Outbox dispatcher (DDR-0007, BDR-0005): polls pending outbox rows and fans
 * out to (a) the in-process event bus and (b) BullMQ (when Redis is
 * configured). At-least-once delivery; consumers deduplicate on event id.
 *
 * RLS discipline (BDR-0007): the dispatcher iterates active tenants (the
 * non-RLS'd isolation root) and claims each tenant's pending events INSIDE
 * that tenant's context — the same rule workers follow. FOR UPDATE SKIP
 * LOCKED makes concurrent dispatchers safe.
 */
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue } from "bullmq";
import type { AppConfig } from "@aiims/config";
import { claimPendingOutboxEvents, listActiveTenantIds, markOutboxDispatched } from "@aiims/db";
import type { EventEnvelope } from "@aiims/event-schemas";
import { CONFIG } from "./config.provider";
import { UnitOfWork } from "./db.provider";
import { EventBus } from "./event-bus";
import { LOGGER, type AppLogger } from "./logger";

/** System identity for dispatcher transactions (never a human actor). */
const SYSTEM_ACTOR = "00000000-0000-7000-8000-000000000000";

@Injectable()
export class OutboxDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private queue: Queue | undefined;
  private running = false;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: AppLogger,
    private readonly uow: UnitOfWork,
    private readonly bus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.REDIS_URL) {
      const url = new URL(this.config.REDIS_URL);
      this.queue = new Queue("domain-events", {
        connection: { host: url.hostname, port: Number(url.port || 6379) },
      });
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.OUTBOX_POLL_INTERVAL_MS);
    this.logger.info(
      { intervalMs: this.config.OUTBOX_POLL_INTERVAL_MS, bullmq: Boolean(this.queue) },
      "outbox dispatcher started",
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.queue?.close();
  }

  /** One poll pass across all active tenants. Exposed for tests. */
  async tick(): Promise<number> {
    if (this.running) return 0; // no overlapping passes
    this.running = true;
    let dispatched = 0;
    try {
      const tenantIds = await listActiveTenantIds(this.uow.rawPool);
      for (const tenantId of tenantIds) {
        dispatched += await this.dispatchForTenant(tenantId);
      }
    } catch (err) {
      this.logger.error({ err: (err as Error).message }, "outbox poll failed");
    } finally {
      this.running = false;
    }
    return dispatched;
  }

  private async dispatchForTenant(tenantId: string): Promise<number> {
    return this.uow.withTenant({ tenantId, actorId: SYSTEM_ACTOR }, async (db) => {
      const events = await claimPendingOutboxEvents(db, this.config.OUTBOX_BATCH_SIZE);
      for (const row of events) {
        const envelope: EventEnvelope = {
          id: row.id,
          tenantId: row.tenantId,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          eventType: row.eventType,
          occurredAt: row.occurredAt.toISOString(),
          payload: row.payload as Record<string, unknown>,
        };
        await this.bus.publish(envelope);
        if (this.queue) {
          await this.queue.add(row.eventType, envelope, {
            jobId: row.id, // dedupe on event id (idempotent consumers)
            removeOnComplete: 1000,
          });
        }
        await markOutboxDispatched(db, row.id);
      }
      return events.length;
    });
  }
}
