import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const CASE_SERVICE_URL =
  process.env['CASE_SERVICE_URL'] ?? 'http://case-service:3001';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { content?: unknown };
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const token = await getToken();
  const res = await fetch(
    `${CASE_SERVICE_URL}/api/v1/cases/${params.id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: body.content }),
    },
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
