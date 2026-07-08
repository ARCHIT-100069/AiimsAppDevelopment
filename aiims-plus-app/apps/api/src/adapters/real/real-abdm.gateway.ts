/**
 * Real ABDM gateway (Stage 8, ADR-0006) — HTTP client to the ABDM (NHA) APIs
 * behind the AbdmGateway port: M1 ABHA verify/create, M2/M3 care-context link.
 * Disabled until `ADAPTER_ABDM=real` + `ABDM_BASE_URL`/`ABDM_CLIENT_ID`/
 * `ABDM_CLIENT_SECRET`; constructed only then and fails fast without them.
 *
 * Endpoint paths follow the ABDM sandbox conventions and are relative to
 * ABDM_BASE_URL — the exact routes are finalised against the NHA sandbox during
 * certification (§18). No PHI is logged. A session token is fetched via client
 * credentials and cached until expiry.
 */
import type { AppConfig } from "@aiims/config";
import { IntegrationError } from "../../common/errors";
import type { AbdmGateway } from "../ports";

export class RealAbdmGateway implements AbdmGateway {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: AppConfig) {
    if (!config.ABDM_BASE_URL || !config.ABDM_CLIENT_ID || !config.ABDM_CLIENT_SECRET) {
      throw new Error(
        "AbdmGateway: ADAPTER_ABDM=real requires ABDM_BASE_URL, ABDM_CLIENT_ID and ABDM_CLIENT_SECRET",
      );
    }
    this.baseUrl = config.ABDM_BASE_URL.replace(/\/$/, "");
    this.clientId = config.ABDM_CLIENT_ID;
    this.clientSecret = config.ABDM_CLIENT_SECRET;
  }

  private async session(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt - 30_000 > now) return this.token.value;
    const res = await this.fetchJson("/v0.5/sessions", {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
    const value = String((res as { accessToken?: string }).accessToken ?? "");
    if (!value) throw new IntegrationError("ABDM returned no access token");
    const expiresIn = Number((res as { expiresIn?: number }).expiresIn ?? 1200) * 1000;
    this.token = { value, expiresAt: now + expiresIn };
    return value;
  }

  async verifyAbha(abhaAddress: string): Promise<{ verified: boolean; reference: string }> {
    const body = await this.fetchJson(
      "/v1/search/existsByHealthId",
      { healthId: abhaAddress },
      true,
    );
    return {
      verified: Boolean((body as { status?: string }).status === "ACTIVE"),
      reference: String((body as { txnId?: string }).txnId ?? ""),
    };
  }

  async createAbha(): Promise<{ abhaNumber: string; abhaAddress: string; reference: string }> {
    const body = await this.fetchJson("/v1/registration/aadhaar/createHealthId", {}, true);
    const b = body as { healthIdNumber?: string; healthId?: string; txnId?: string };
    if (!b.healthIdNumber || !b.healthId)
      throw new IntegrationError("ABDM create returned no ABHA");
    return {
      abhaNumber: b.healthIdNumber,
      abhaAddress: b.healthId,
      reference: String(b.txnId ?? ""),
    };
  }

  async linkCareContext(input: {
    patientRef: string;
    encounterRef: string;
    consentArtifactRef: string;
  }): Promise<{ careContextRef: string }> {
    const body = await this.fetchJson(
      "/v0.5/links/link/add-contexts",
      {
        patient: { referenceNumber: input.patientRef },
        careContexts: [{ referenceNumber: input.encounterRef }],
        consent: { id: input.consentArtifactRef },
      },
      true,
    );
    return {
      careContextRef: String(
        (body as { linkRefNumber?: string }).linkRefNumber ?? input.encounterRef,
      ),
    };
  }

  private async fetchJson(path: string, payload: unknown, authed = false): Promise<unknown> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (authed) headers.authorization = `Bearer ${await this.session()}`;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new IntegrationError(`ABDM unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) throw new IntegrationError(`ABDM error ${res.status} on ${path}`);
    return res.json();
  }
}
