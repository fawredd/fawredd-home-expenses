/**
 * API response and error handling utilities
 */
import { NextResponse } from "next/server";
import { AppError, ErrorCodes, type ApiResponse } from "./types";
import { ZodError } from "zod";

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  message?: string,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}

/**
 * Error response helper
 */
export function errorResponse(
  error: unknown,
  statusCode: number = 500,
): NextResponse<ApiResponse<null>> {
  let message = "Internal server error";
  let code = ErrorCodes.INTERNAL_ERROR;

  if (error instanceof AppError) {
    message = error.message;
    code = error.code || ErrorCodes.INTERNAL_ERROR;
    statusCode = error.statusCode;
  } else if (error instanceof ZodError) {
    message = "Validation error";
    code = ErrorCodes.VALIDATION_ERROR;
    statusCode = 400;
  } else if (error instanceof Error) {
    message = error.message;
  }

  console.error(`[API Error] ${code}: ${message}`, error);

  return NextResponse.json(
    {
      success: false,
      error: code,
      message,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}

/**
 * Validation error response helper
 */
export function validationErrorResponse(
  errors: ZodError,
): NextResponse<ApiResponse<Array<{ field: string; message: string }>>> {
  const formatted = errors.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return NextResponse.json(
    {
      success: false,
      error: ErrorCodes.VALIDATION_ERROR,
      message: "Validation failed",
      data: formatted,
      timestamp: new Date().toISOString(),
    },
    { status: 400 },
  );
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error("[API Handler Error]", error);
      return errorResponse(error);
    }
  };
}

/**
 * Parse request body with validation
 */
export async function parseAndValidateRequest<T>(
  request: Request,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, "Validation error", ErrorCodes.VALIDATION_ERROR);
    }
    throw new AppError(400, "Invalid request body", ErrorCodes.INVALID_REQUEST);
  }
}

/**
 * Common HTTP error responses
 */
export const HttpErrors = {
  notFound: (resource: string) =>
    new AppError(404, `${resource} not found`, ErrorCodes.NOT_FOUND),

  badRequest: (message: string) =>
    new AppError(400, message, ErrorCodes.INVALID_REQUEST),

  unauthorized: () =>
    new AppError(401, "Unauthorized", ErrorCodes.INTERNAL_ERROR),

  forbidden: () => new AppError(403, "Forbidden", ErrorCodes.INTERNAL_ERROR),

  conflict: (message: string) =>
    new AppError(409, message, ErrorCodes.DUPLICATE_ENTRY),

  internalError: (message: string = "Internal server error") =>
    new AppError(500, message, ErrorCodes.INTERNAL_ERROR),

  serviceUnavailable: () =>
    new AppError(503, "Service unavailable", ErrorCodes.SERVICE_UNAVAILABLE),
};

/**
 * Logging utility
 */
export const Logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[INFO] ${message}`, data);
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${message}`, data);
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${message}`, error);
  },
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
};
