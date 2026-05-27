/**
 * GET /api/categories
 * List all available categories
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching all categories");

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";

    const allCategories = await db
      .select()
      .from(categories)
      .where(includeInactive ? undefined : eq(categories.isActive, true));

    return successResponse({
      categories: allCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentId: cat.parentId,
        color: cat.color,
        icon: cat.icon,
        isActive: cat.isActive,
      })),
    });
  } catch (error) {
    Logger.error("Failed to fetch categories", error);
    return errorResponse(error);
  }
}
