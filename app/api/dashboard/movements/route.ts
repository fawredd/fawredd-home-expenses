/**
 * GET /api/dashboard/movements
 * Get filtered list of movements for dashboard table
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { getDashboardMovements } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching dashboard movements");

    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      startDate: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
      endDate: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
      categoryIds: searchParams.getAll("categoryIds") as string[],
      vendorSearch: searchParams.get("vendorSearch") || undefined,
      minAmount: searchParams.get("minAmount") ? parseFloat(searchParams.get("minAmount")!) : undefined,
      maxAmount: searchParams.get("maxAmount") ? parseFloat(searchParams.get("maxAmount")!) : undefined,
      movementType: (searchParams.get("movementType") as "income" | "expense" | "all") || "all",
      sortBy: (searchParams.get("sortBy") as "date" | "amount" | "vendor" | "category") || "date",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
      limit: parseInt(searchParams.get("limit") || "50"),
      offset: parseInt(searchParams.get("offset") || "0"),
    };

    const result = await getDashboardMovements(filters);

    return successResponse({
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
      movements: result.movements,
    });
  } catch (error) {
    Logger.error("Failed to fetch dashboard movements", error);
    return errorResponse(error);
  }
}
