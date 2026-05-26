/**
 * Server-side API client for cases.
 * Uses internal service URL (not public) — never calls case-service from client.
 */

import { auth } from '@clerk/nextjs/server';
import type { Case } from '@exitforge/shared';

const CASE_SERVICE_URL =
  process.env['CASE_SERVICE_URL'] ?? 'http://case-service:3001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) throw new Error('Unauthenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getCase(id: string): Promise<Case & {
  timeshare: {
    resort: { name: string };
    maintenanceFeeAnnual: number;
    outstandingMortgage: number;
    contractYear: number;
    purchasePrice: number;
  } | null;
  negotiations: unknown[];
  documents: unknown[];
  events: unknown[];
  messages: unknown[];
  fee: unknown | null;
} | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${CASE_SERVICE_URL}/api/v1/cases/${id}`, {
      headers,
      next: { revalidate: 30 }, // Revalidate every 30 seconds
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Case service returned ${res.status}`);

    const json = await res.json() as { data: unknown };
    return json.data as Awaited<ReturnType<typeof getCase>>;
  } catch {
    return null;
  }
}

export async function getMyCases(): Promise<Case[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${CASE_SERVICE_URL}/api/v1/cases`, {
    headers,
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Case service returned ${res.status}`);
  const json = await res.json() as { data: Case[] };
  return json.data;
}
