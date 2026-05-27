/**
 * GET /api/dashboard/annual-summary
 * Get annual income, expense, and balance summary
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching annual summary");

    // TODO: Implement annual summary aggregation
    return successResponse({
      summary: [],
    });
  } catch (error) {
    Logger.error("Failed to fetch annual summary", error);
    return errorResponse(error);
  }
}
