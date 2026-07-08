/**
 * Real payment gateway (Stage 8) — a generic Bearer-authenticated HTTP client
 * behind the PaymentGateway port. Disabled until `ADAPTER_PAYMENT=real` AND
 * `PAYMENT_BASE_URL` + `PAYMENT_API_KEY` are supplied; constructed only then,
 * and it fails fast if credentials are missing. No card data or PHI is logged.
 */
import type { AppConfig } from "@aiims/config";
import { IntegrationError } from "../../common/errors";
import type { PaymentGateway } from "../ports";

export class RealPaymentGateway implements PaymentGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: AppConfig) {
    if (!config.PAYMENT_BASE_URL || !config.PAYMENT_API_KEY) {
      throw new Error(
        "PaymentGateway: ADAPTER_PAYMENT=real requires PAYMENT_BASE_URL and PAYMENT_API_KEY",
      );
    }
    this.baseUrl = config.PAYMENT_BASE_URL.replace(/\/$/, "");
    this.apiKey = config.PAYMENT_API_KEY;
  }

  async createPaymentIntent(input: {
    amount: string;
    currency: string;
    reference: string;
  }): Promise<{ intentRef: string; status: "created" }> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/payment_intents`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": input.reference,
        },
        body: JSON.stringify({
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new IntegrationError(`payment gateway unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) throw new IntegrationError(`payment gateway error ${res.status}`);
    const body = (await res.json()) as { id?: string; reference?: string };
    const intentRef = body.id ?? body.reference;
    if (!intentRef) throw new IntegrationError("payment gateway returned no intent reference");
    return { intentRef, status: "created" };
  }
}
