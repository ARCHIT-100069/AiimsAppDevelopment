/**
 * Per-request context via AsyncLocalStorage: correlation id (APDR-0003 §21)
 * and — once AuthN succeeds — the verified Principal that drives the RLS
 * tenant context (SDR-0003) and audit actor identity.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { AuthenticatedParty } from "@aiims/domain-types";
import type { NextFunction, Request, Response } from "express";

export interface RequestContext {
  correlationId: string;
  principal?: AuthenticatedParty;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
  res.setHeader("x-correlation-id", correlationId);
  storage.run({ correlationId }, next);
}

export function currentContext(): RequestContext {
  return storage.getStore() ?? { correlationId: "no-request-context" };
}

export function setPrincipal(principal: AuthenticatedParty): void {
  const ctx = storage.getStore();
  if (ctx) ctx.principal = principal;
}

export function currentPrincipal(): AuthenticatedParty | undefined {
  return storage.getStore()?.principal;
}
