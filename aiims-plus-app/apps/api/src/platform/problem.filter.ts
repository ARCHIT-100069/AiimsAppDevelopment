/**
 * Global exception filter (APDR-0003, BDR-0010): every error becomes an
 * RFC 9457 Problem Details response with a stable code and correlation id.
 * NEVER leaks PHI, secrets, or stack traces (SDR-0009/0010) — 5xx bodies are
 * generic; details go to the structured log only.
 */
import {
  Catch,
  HttpException,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { ERROR_CODES, type ProblemDetails } from "@aiims/api-contracts";
import type { Response } from "express";
import { ZodError } from "zod";
import { LOGGER, type AppLogger } from "./logger";
import { currentContext } from "./request-context";
import { AppError } from "../common/errors";

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = currentContext().correlationId;

    let problem: ProblemDetails;

    if (exception instanceof ZodError) {
      const meta = ERROR_CODES.VALIDATION_FAILED;
      problem = {
        type: "about:blank",
        title: meta.title,
        status: meta.status,
        code: "VALIDATION_FAILED",
        correlationId,
        errors: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    } else if (exception instanceof AppError) {
      const meta = ERROR_CODES[exception.code];
      problem = {
        type: "about:blank",
        title: meta.title,
        status: meta.status,
        code: exception.code,
        detail: exception.message,
        correlationId,
      };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      problem = {
        type: "about:blank",
        title: exception.message,
        status,
        code: status === 404 ? "NOT_FOUND" : "INTERNAL",
        correlationId,
      };
    } else {
      const meta = ERROR_CODES.INTERNAL;
      // Full detail to logs (no PHI by logging discipline); generic to client.
      this.logger.error(
        { correlationId, err: exception instanceof Error ? exception.stack : String(exception) },
        "unhandled exception",
      );
      problem = {
        type: "about:blank",
        title: meta.title,
        status: meta.status,
        code: "INTERNAL",
        detail: "An unexpected error occurred. Quote the correlationId when reporting.",
        correlationId,
      };
    }

    response.status(problem.status).type("application/problem+json").json(problem);
  }
}
