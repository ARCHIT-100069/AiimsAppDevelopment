/**
 * In-process event bus (BDR-0005): synchronous same-process reactions to
 * dispatched outbox events. Honest labeling (Blueprint §14): in the monolith
 * era this is durable eventing within one process, not a distributed fabric —
 * the outbox + versioned schemas make the later broker hop mechanical.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { EventEnvelope } from "@aiims/event-schemas";
import { LOGGER, type AppLogger } from "./logger";

export type EventHandler = (event: EventEnvelope) => Promise<void> | void;

@Injectable()
export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(@Inject(LOGGER) private readonly logger: AppLogger) {}

  subscribe(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  /** At-least-once semantics: handlers must be idempotent (BDR-0005). */
  async publish(event: EventEnvelope): Promise<void> {
    for (const handler of this.handlers.get(event.eventType) ?? []) {
      try {
        await handler(event);
      } catch (err) {
        // A failing in-process handler never blocks other handlers/dispatch.
        this.logger.error(
          { eventId: event.id, eventType: event.eventType, err: (err as Error).message },
          "event handler failed",
        );
      }
    }
  }
}
