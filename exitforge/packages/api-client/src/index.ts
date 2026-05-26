import type { ApiSuccessResponse, ApiErrorResponse, Case, CreateCaseInput, Message } from '@exitforge/shared';

export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null | undefined>;
}

async function request<T>(
  config: ClientConfig,
  path: string,
  init?: RequestInit,
): Promise<ApiSuccessResponse<T>> {
  const token = await config.getToken();
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok) {
    const err = json as ApiErrorResponse;
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return json as ApiSuccessResponse<T>;
}

export function createCaseClient(config: ClientConfig) {
  return {
    getMyCases(): Promise<ApiSuccessResponse<Case[]>> {
      return request<Case[]>(config, '/api/v1/cases');
    },
    getCase(id: string): Promise<ApiSuccessResponse<Case>> {
      return request<Case>(config, `/api/v1/cases/${id}`);
    },
    createCase(input: CreateCaseInput): Promise<ApiSuccessResponse<Case>> {
      return request<Case>(config, '/api/v1/cases', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    sendMessage(caseId: string, content: string): Promise<ApiSuccessResponse<Message>> {
      return request<Message>(config, `/api/v1/cases/${caseId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
  };
}
