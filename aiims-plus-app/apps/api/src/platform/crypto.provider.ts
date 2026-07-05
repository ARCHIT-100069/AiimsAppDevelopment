/**
 * PHI field-crypto wiring (DDR-0006/SDR-0005 via the KeyProvider seam,
 * decision S2-b): "local" provider for the compose substrate; "aws-kms"
 * activates at AWS bootstrap with the same enc_key_ref format and call sites.
 */
import { Injectable, Inject } from "@nestjs/common";
import {
  computeBlindIndex,
  FieldCipher,
  LocalKeyProvider,
  type BlindIndexKind,
  type KeyProvider,
} from "@aiims/crypto";
import type { AppConfig } from "@aiims/config";
import { CONFIG } from "./config.provider";

export function buildKeyProvider(config: AppConfig): KeyProvider {
  if (config.KEY_PROVIDER === "aws-kms") {
    // Wired at AWS bootstrap (SDR-0005 CMK hierarchy) — refusing beats pretending.
    throw new Error("aws-kms key provider lands with the AWS bootstrap; use KEY_PROVIDER=local");
  }
  if (!config.AIIMS_FIELD_MASTER_KEY || !config.AIIMS_BLIND_INDEX_KEY) {
    throw new Error(
      "KEY_PROVIDER=local requires AIIMS_FIELD_MASTER_KEY and AIIMS_BLIND_INDEX_KEY (BDR-0011 fail-fast)",
    );
  }
  return new LocalKeyProvider(config.AIIMS_FIELD_MASTER_KEY, config.AIIMS_BLIND_INDEX_KEY);
}

@Injectable()
export class CryptoService {
  readonly cipher: FieldCipher;
  private readonly provider: KeyProvider;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.provider = buildKeyProvider(config);
    this.cipher = new FieldCipher(this.provider);
  }

  /** Tenant-salted blind index for exact-match lookup (decision S2-f). */
  blindIndex(kind: BlindIndexKind, tenantId: string, value: string): Buffer {
    return computeBlindIndex(this.provider.indexKey(), tenantId, kind, value);
  }
}
