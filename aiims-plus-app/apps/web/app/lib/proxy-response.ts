import { NextResponse } from "next/server";

/**
 * Relay an upstream API Response through the BFF, preserving status and
 * content-type only (no header leakage). Shared by the BFF patient routes.
 */
export function relay(res: Response): NextResponse {
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new NextResponse(res.body, { status: res.status, headers });
}
