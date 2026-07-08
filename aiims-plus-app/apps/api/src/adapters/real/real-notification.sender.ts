/**
 * Real notification sender (Stage 8) — a generic Bearer-authenticated HTTP
 * client behind the NotificationSender port. Payload is a template reference +
 * recipient reference (never raw PHI, SDR-0004). Disabled until
 * `ADAPTER_NOTIFICATION=real` + `NOTIFICATION_BASE_URL`/`NOTIFICATION_API_KEY`.
 */
import type { AppConfig } from "@aiims/config";
import { IntegrationError } from "../../common/errors";
import type { NotificationSender } from "../ports";

export class RealNotificationSender implements NotificationSender {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: AppConfig) {
    if (!config.NOTIFICATION_BASE_URL || !config.NOTIFICATION_API_KEY) {
      throw new Error(
        "NotificationSender: ADAPTER_NOTIFICATION=real requires NOTIFICATION_BASE_URL and NOTIFICATION_API_KEY",
      );
    }
    this.baseUrl = config.NOTIFICATION_BASE_URL.replace(/\/$/, "");
    this.apiKey = config.NOTIFICATION_API_KEY;
  }

  async send(input: {
    channel: "sms" | "email";
    templateRef: string;
    recipientRef: string;
  }): Promise<{ accepted: boolean; messageRef: string }> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          channel: input.channel,
          template: input.templateRef,
          to: input.recipientRef,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new IntegrationError(`notification provider unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) throw new IntegrationError(`notification provider error ${res.status}`);
    const body = (await res.json()) as { id?: string; messageRef?: string };
    const messageRef = body.id ?? body.messageRef ?? "";
    return { accepted: true, messageRef };
  }
}
