import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";

@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const correlationId = randomUUID();
    if (err instanceof ZodError) {
      return res.status(422).send({ type: "about:blank", title: "Validation failed", status: 422, code: "validation_error",
        correlationId, errors: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })) });
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      return res.status(status).send({ type: "about:blank", title: err.name, status,
        code: status === 403 ? "forbidden" : status === 401 ? "unauthorized" : "error", correlationId });
    }
    // Never leak internals/PHI/stack. Log correlationId server-side only.
    console.error(JSON.stringify({ level: "error", correlationId, msg: "unhandled" })); // no PHI
    return res.status(500).send({ type: "about:blank", title: "Internal Server Error", status: 500, code: "internal", correlationId });
  }
}
