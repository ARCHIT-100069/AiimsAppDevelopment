/**
 * Error taxonomy (BDR-0010): typed classes mapped to Problem Details by the
 * global filter. Messages must be SAFE — never PHI, secrets, or internals.
 */
import type { ErrorCode } from "@aiims/api-contracts";

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  constructor(safeMessage: string) {
    super(safeMessage);
    this.name = new.target.name;
  }
}

/** Business-rule/invariant violation (domain layer). */
export class DomainError extends AppError {
  readonly code = "VALIDATION_FAILED";
}

export class UnauthenticatedError extends AppError {
  readonly code = "UNAUTHENTICATED";
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
}

/** External adapter failure — degrades gracefully, off the critical path. */
export class IntegrationError extends AppError {
  readonly code = "INTEGRATION_UNAVAILABLE";
}
