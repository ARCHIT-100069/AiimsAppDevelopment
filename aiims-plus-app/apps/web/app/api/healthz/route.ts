import { NextResponse } from "next/server";

/** Public liveness for the web tier; also marks where BFF routes will live. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "aiims-web", version: "0.0.0" });
}
