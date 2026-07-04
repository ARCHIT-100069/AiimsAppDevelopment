import { loadConfig, type AppConfig } from "@aiims/config";

export const CONFIG = Symbol("CONFIG");

/** Parsed once at boot; the process refuses to start on invalid config (BDR-0011). */
export function provideConfig(): { provide: symbol; useValue: AppConfig } {
  return { provide: CONFIG, useValue: loadConfig() };
}
