/**
 * AIIMS+ shared ESLint flat config.
 *
 * Mechanically enforces the frozen architecture (violations FAIL CI):
 *  - BDR-0013 — dependency-inward layering:
 *      api → application → domain ← ports ← infrastructure
 *    The domain layer imports no framework, no ORM, no HTTP.
 *  - BDR-0002 — a module never imports another module's internals.
 *  - ADR-0011 / BDR-0003 — Drizzle (and the pg driver) exist ONLY in packages/db;
 *    ORM types never leak, preserving the sanctioned Prisma fallback.
 *  - SDR-0010 — no console logging; all output goes through the structured,
 *    PHI-redacting logger.
 */
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

/** Layers inside an apps/api bounded-context module (BDR-0001). */
const moduleLayerElements = [
  { type: "module-api", pattern: "apps/api/src/modules/*/api/**", capture: ["module"] },
  { type: "module-application", pattern: "apps/api/src/modules/*/application/**", capture: ["module"] },
  { type: "module-domain", pattern: "apps/api/src/modules/*/domain/**", capture: ["module"] },
  { type: "module-ports", pattern: "apps/api/src/modules/*/ports/**", capture: ["module"] },
  { type: "module-infrastructure", pattern: "apps/api/src/modules/*/infrastructure/**", capture: ["module"] },
  { type: "module-root", mode: "file", pattern: "apps/api/src/modules/*/*.ts", capture: ["module"] },
];

const sameModule = (allowedType) => [allowedType, { module: "${from.module}" }];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/*.d.ts", "**/coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // SDR-0010: structured no-PHI logger only — console output is unredacted.
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // ADR-0011 guardrail: the ORM and driver are confined to packages/db.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    ignores: ["packages/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "drizzle-orm", message: "Drizzle is confined to packages/db (ADR-0011, BDR-0003)." },
            { name: "drizzle-kit", message: "drizzle-kit is confined to packages/db (DDR-0011)." },
            { name: "pg", message: "The pg driver is confined to packages/db (BDR-0003)." },
          ],
          patterns: [
            { group: ["drizzle-orm/*", "drizzle-kit/*", "pg/*"], message: "ORM/driver internals are confined to packages/db (ADR-0011)." },
          ],
        },
      ],
    },
  },
  {
    // Domain purity (BDR-0001/0013): no NestJS, no HTTP, no IO in the domain layer.
    files: ["apps/api/src/modules/*/domain/**/*.ts", "packages/domain-types/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@nestjs/*"], message: "The domain layer is framework-free (BDR-0001)." },
            { group: ["drizzle-orm", "drizzle-orm/*", "pg", "pg/*"], message: "The domain layer never sees the ORM (BDR-0003)." },
            { group: ["node:http*", "express", "fastify", "axios", "undici"], message: "The domain layer performs no IO (BDR-0001)." },
            { group: ["ioredis", "bullmq"], message: "The domain layer performs no IO (BDR-0001)." },
          ],
        },
      ],
    },
  },
  {
    // BDR-0013 layer matrix + BDR-0002 module boundaries, resolved on real file paths.
    files: ["apps/api/src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        ...moduleLayerElements,
        { type: "platform", pattern: "apps/api/src/platform/**" },
        { type: "adapters", pattern: "apps/api/src/adapters/**" },
        { type: "common", pattern: "apps/api/src/common/**" },
        { type: "app-root", mode: "file", pattern: "apps/api/src/*.ts" },
      ],
      "boundaries/include": ["apps/api/src/**/*.ts"],
      "import/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message:
            "${file.type} may not import ${dependency.type} — dependency direction is enforced by BDR-0013/BDR-0002.",
          rules: [
            // Controllers call one application service; they may see domain types and ports.
            { from: ["module-api"], allow: [sameModule("module-application"), sameModule("module-domain"), sameModule("module-ports"), "platform", "common"] },
            // Application services orchestrate domain + ports (never infrastructure directly).
            { from: ["module-application"], allow: [sameModule("module-domain"), sameModule("module-ports"), "platform", "common"] },
            // The domain depends on nothing outward. (Same-module domain files only.)
            { from: ["module-domain"], allow: [sameModule("module-domain")] },
            // Ports are domain-owned interfaces.
            { from: ["module-ports"], allow: [sameModule("module-domain"), sameModule("module-ports")] },
            // Infrastructure implements ports and maps rows → domain objects.
            { from: ["module-infrastructure"], allow: [sameModule("module-domain"), sameModule("module-ports"), "platform", "common"] },
            // The module definition file wires all of its own layers.
            { from: ["module-root"], allow: [sameModule("module-api"), sameModule("module-application"), sameModule("module-domain"), sameModule("module-ports"), sameModule("module-infrastructure"), "platform", "common"] },
            // Platform/cross-cutting and adapters may use each other and common.
            { from: ["platform"], allow: ["platform", "common"] },
            { from: ["adapters"], allow: ["adapters", "platform", "common"] },
            { from: ["common"], allow: ["common"] },
            // Composition root (main.ts / app.module.ts) wires everything.
            { from: ["app-root"], allow: ["module-root", "module-api", "platform", "adapters", "common", "app-root"] },
          ],
        },
      ],
    },
  }
);
