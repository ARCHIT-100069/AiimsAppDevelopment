/**
 * CONTRACT-COVERAGE GATE (APDR-0014, closes health-report M-1).
 *
 * The OpenAPI document is DERIVED from the Zod contracts and must describe the
 * whole HTTP surface. This test reflects over the REAL Nest module graph (no
 * app boot, no DB — pure metadata) and asserts every mounted controller route
 * appears in `openApiDocument.paths`. A new endpoint that isn't documented
 * fails CI here, so the artifact can never silently drift behind the code.
 */
import { MODULE_METADATA, PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { openApiDocument } from "@aiims/api-contracts/generate-openapi";
import { describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

type Ctor = new (...args: unknown[]) => unknown;

/** Recursively collect every controller class from a module (static + dynamic). */
function collectControllers(entry: unknown, seen = new Set<unknown>()): Ctor[] {
  if (!entry) return [];
  // Unwrap forwardRef(() => Module)
  const ref = entry as { forwardRef?: () => unknown };
  if (typeof ref.forwardRef === "function") return collectControllers(ref.forwardRef(), seen);

  // A DynamicModule is an object carrying { module, controllers?, imports? }.
  const dyn = entry as { module?: unknown; controllers?: Ctor[]; imports?: unknown[] };
  const moduleClass = (dyn.module ?? entry) as object;
  if (seen.has(moduleClass)) return [];
  seen.add(moduleClass);

  const own = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? []) as Ctor[];
  const dynControllers = dyn.controllers ?? [];
  const staticImports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ??
    []) as unknown[];
  const dynImports = dyn.imports ?? [];

  const nested = [...staticImports, ...dynImports].flatMap((m) => collectControllers(m, seen));
  return [...own, ...dynControllers, ...nested];
}

const METHOD_NAME: Record<number, string> = {
  [RequestMethod.GET]: "get",
  [RequestMethod.POST]: "post",
  [RequestMethod.PUT]: "put",
  [RequestMethod.DELETE]: "delete",
  [RequestMethod.PATCH]: "patch",
  [RequestMethod.OPTIONS]: "options",
  [RequestMethod.HEAD]: "head",
};

/** "/v1", ":id/roles" -> "/v1/{id}/roles" (OpenAPI path templating). */
function joinPath(base: string, sub: string): string {
  const segs = `${base}/${sub}`
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith(":") ? `{${s.slice(1)}}` : s));
  return `/${segs.join("/")}`;
}

interface Route {
  method: string;
  path: string;
}

function routesForController(controller: Ctor): Route[] {
  const base = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? "";
  const proto = controller.prototype as object;
  const routes: Route[] = [];
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === "constructor") continue;
    const handler = (proto as Record<string, unknown>)[name];
    const method = Reflect.getMetadata(METHOD_METADATA, handler as object);
    if (typeof method !== "number") continue; // not a route handler
    const sub = (Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined) ?? "";
    routes.push({ method: METHOD_NAME[method]!, path: joinPath(base, sub) });
  }
  return routes;
}

describe("OpenAPI covers the entire HTTP surface (M-1 gate)", () => {
  const controllers = collectControllers(AppModule);
  const routes = controllers.flatMap(routesForController);
  const paths = openApiDocument.paths as Record<string, Record<string, unknown>>;

  it("discovers a non-trivial route table from the real module graph", () => {
    // Guards against a silently-empty walk giving a false pass.
    expect(routes.length).toBeGreaterThanOrEqual(15);
    expect(routes.some((r) => r.path === "/v1/patients" && r.method === "post")).toBe(true);
    expect(routes.some((r) => r.path === "/v1/practitioners" && r.method === "post")).toBe(true);
  });

  it("every mounted route is documented in openApiDocument.paths", () => {
    const missing = routes.filter((r) => !paths[r.path]?.[r.method]);
    expect(missing, `Undocumented routes: ${JSON.stringify(missing)}`).toEqual([]);
  });
});
