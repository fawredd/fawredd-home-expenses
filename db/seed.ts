import { db } from "./index";
import { categories } from "./schema";

export async function seed() {
  try {
    console.log("Starting database seed...");

    // Default categories (Spanish)
    const defaultCategories = [
      {
        name: "Ingresos",
        description: "Income category",
        parentId: null,
        color: "#00C853",
        icon: "trending-up",
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Gastos",
        description: "Expenses category",
        parentId: null,
        color: "#FF5252",
        icon: "trending-down",
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "Alimentos",
        description: "Groceries and food",
        parentId: null, // Will set after insert
        color: "#FFA726",
        icon: "shopping-cart",
        isActive: true,
        sortOrder: 3,
      },
      {
        name: "Servicios",
        description: "Utilities (electricity, water, internet)",
        parentId: null,
        color: "#42A5F5",
        icon: "zap",
        isActive: true,
        sortOrder: 4,
      },
      {
        name: "Transporte",
        description: "Transportation and fuel",
        parentId: null,
        color: "#AB47BC",
        icon: "car",
        isActive: true,
        sortOrder: 5,
      },
      {
        name: "Salud",
        description: "Healthcare and medical",
        parentId: null,
        color: "#EC407A",
        icon: "heart",
        isActive: true,
        sortOrder: 6,
      },
      {
        name: "Entretenimiento",
        description: "Entertainment and leisure",
        parentId: null,
        color: "#29B6F6",
        icon: "film",
        isActive: true,
        sortOrder: 7,
      },
      {
        name: "Otros",
        description: "Other expenses",
        parentId: null,
        color: "#9E9E9E",
        icon: "more-horizontal",
        isActive: true,
        sortOrder: 8,
      },
      {
        name: "Sin Categorizar",
        description: "Awaiting manual review",
        parentId: null,
        color: "#BDBDBD",
        icon: "help-circle",
        isActive: true,
        sortOrder: 9,
      },
    ];

    // Check if categories already exist
    const existingCount = await db
      .select({ count: categories.id })
      .from(categories);

    if (existingCount.length > 0) {
      console.log("Categories already exist, skipping seed");
      return;
    }

    // Insert categories
    const inserted = await db
      .insert(categories)
      .values(defaultCategories)
      .returning();

    console.log(`✅ Seeded ${inserted.length} default categories`);

    // Log inserted categories
    inserted.forEach((cat) => {
      console.log(`  - ${cat.name} (${cat.color})`);
    });
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed().then(() => process.exit(0));
}
