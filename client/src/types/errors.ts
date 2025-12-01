/**
 * Standardized error types matching backend ApiErrorResponse
 */

export enum ErrorCode {
  // 400-level errors (client errors)
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_TICKER = "INVALID_TICKER",
  INVALID_DATE_RANGE = "INVALID_DATE_RANGE",
  DATA_UNAVAILABLE = "DATA_UNAVAILABLE", // Ticker not found, no data returned

  // 500-level errors (server/upstream errors)
  UPSTREAM_ERROR = "UPSTREAM_ERROR", // yfinance/data provider is down
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface ApiErrorResponse {
  error_code: string; // ErrorCode enum value
  http_status: number;
  message: string; // Human-readable message for display
  details?: Record<string, unknown>; // Additional context (e.g., failed tickers, retry info)
}

/**
 * Check if an error response is a structured API error
 */
export function isApiErrorResponse(obj: unknown): obj is ApiErrorResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "error_code" in obj &&
    "http_status" in obj &&
    "message" in obj
  );
}

/**
 * Extract user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (isApiErrorResponse(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
}

/**
 * Check if error is a temporary upstream issue (should show retry option)
 */
export function isRetryableError(error: unknown): boolean {
  if (isApiErrorResponse(error)) {
    return error.error_code === ErrorCode.UPSTREAM_ERROR;
  }
  return false;
}

/**
 * Check if error is a data availability issue (ticker doesn't exist)
 */
export function isDataUnavailableError(error: unknown): boolean {
  if (isApiErrorResponse(error)) {
    return error.error_code === ErrorCode.DATA_UNAVAILABLE;
  }
  return false;
}
