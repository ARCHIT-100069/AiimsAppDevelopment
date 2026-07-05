import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "../../../lib/session";

/** Clear the server session; the browser held nothing to clear (SDR-0001). */
export async function POST(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
