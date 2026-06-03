/**
 * GET /api/dashboard/uncategorized-count
 * Get count of movements awaiting categorization
 */
import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  Logger,
  getCurrentUserId,
} from "@/lib/api-utils";
import { countUncategorized } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching uncategorized count");

    const userId = getCurrentUserId(request);
    const count = await countUncategorized(userId);

    return successResponse({
      uncategorizedCount: count,
    });
  } catch (error) {
    Logger.error("Failed to fetch uncategorized count", error);
    return errorResponse(error);
  }
}
