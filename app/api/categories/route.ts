/**
 * GET /api/categories
 * List all available categories
 */
import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  Logger,
  HttpErrors,
} from "@/lib/api-utils";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CreateCategorySchema } from "@/lib/types";

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

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const { name, color } = CreateCategorySchema.parse(rawBody);

    Logger.info(`Creating new category: ${name}`);

    // Check if category already exists
    const existing = await db.query.categories.findFirst({
      where: eq(categories.name, name),
    });

    if (existing) {
      throw HttpErrors.badRequest("La categoría ya existe");
    }

    const inserted = await db
      .insert(categories)
      .values({
        name,
        color: color || "#6B7280", // Default gray
      })
      .onConflictDoNothing({ target: categories.name })
      .returning();

    if (inserted.length === 0) {
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.name, name),
      });

      if (!existingCategory) {
        throw new Error("Category conflict without existing category");
      }

      return successResponse(existingCategory, 200, "La categoría ya existe");
    }

    return successResponse(inserted[0], 201, "Categoría creada correctamente");
  } catch (error) {
    Logger.error("Failed to create category", error);
    return errorResponse(error);
  }
}
