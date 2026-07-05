import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiFetch(`/v1/patients/${id}`);
  return new NextResponse(res.body, { status: res.status, headers: ct(res) });
}

/** Update; forwards the If-Match version for optimistic concurrency (409). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  const res = await apiFetch(`/v1/patients/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "if-match": req.headers.get("if-match") ?? "",
    },
    body,
  });
  return new NextResponse(res.body, { status: res.status, headers: ct(res) });
}

function ct(res: Response): HeadersInit {
  const h = new Headers();
  const c = res.headers.get("content-type");
  if (c) h.set("content-type", c);
  return h;
}
