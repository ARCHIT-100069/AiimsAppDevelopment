// Dependency-inward enforcement (BDR-0013): domain has no framework/ORM/HTTP imports;
// Drizzle only in @aiims/db; nothing depends on an app.
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    files: ["**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain", pattern: "apps/api/src/modules/*/domain/**" },
        { type: "application", pattern: "apps/api/src/modules/*/application/**" },
        { type: "api", pattern: "apps/api/src/modules/*/api/**" },
        { type: "ports", pattern: "apps/api/src/modules/*/ports/**" },
        { type: "infrastructure", pattern: "apps/api/src/modules/*/infrastructure/**" },
        { type: "db", pattern: "packages/db/**" }
      ]
    },
    rules: {
      // domain must not import outward (no db/http/nest); enforced by element rules
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "api", allow: ["application", "domain", "ports"] },
          { from: "application", allow: ["domain", "ports"] },
          { from: "domain", allow: ["domain"] },
          { from: "infrastructure", allow: ["ports", "domain", "db"] }
        ]
      }],
      // ORM confinement: only @aiims/db may import drizzle-orm
      "no-restricted-imports": ["error", {
        paths: [{ name: "drizzle-orm", message: "Drizzle is confined to @aiims/db (ADR 0011 / BDR-0003)." }]
      }]
    }
  },
  {
    // exception: @aiims/db is the one place drizzle-orm is allowed
    files: ["packages/db/**/*.ts"],
    rules: { "no-restricted-imports": "off" }
  }
];
