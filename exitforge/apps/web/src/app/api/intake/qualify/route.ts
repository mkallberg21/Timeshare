import { NextRequest, NextResponse } from "next/server";

const ML_SERVICE_URL = process.env["ML_SERVICE_URL"] ?? "http://ml-service:8001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;

    const mlResp = await fetch(`${ML_SERVICE_URL}/predict/qualification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!mlResp.ok) {
      return NextResponse.json(
        { error: "Qualification service unavailable" },
        { status: 502 },
      );
    }

    const data: unknown = await mlResp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
