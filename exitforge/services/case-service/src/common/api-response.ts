import type { ApiSuccessResponse } from '@exitforge/shared';

export class ApiResponse {
  static success<T>(data: T, meta?: ApiSuccessResponse<T>['meta']): ApiSuccessResponse<T> {
    return { success: true, data, ...(meta ? { meta } : {}) };
  }
}
