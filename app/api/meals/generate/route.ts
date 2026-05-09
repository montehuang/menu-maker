import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateMeals } from "@/lib/deepseek";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { buildReferenceLinks } from "@/lib/reference-links";
import { MealType } from "@/types";

const generateSchema = z.object({
  note: z.string().max(200).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  targetMeals: z
    .array(z.enum(["lunch", "dinner"]))
    .min(1)
    .default(["lunch", "dinner"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { note, categoryIds, targetMeals } = parsed.data;

  // Fetch categories and inventory in parallel
  const [categoriesResult, inventoryResult] = await Promise.all([
    supabase.from("dish_categories").select("*").order("sort_order"),
    supabase
      .from("inventory")
      .select("*, ingredient:ingredients(*)")
      .gt("quantity", 0),
  ]);

  if (categoriesResult.error) {
    return NextResponse.json(
      { error: categoriesResult.error.message },
      { status: 500 },
    );
  }
  if (inventoryResult.error) {
    return NextResponse.json(
      { error: inventoryResult.error.message },
      { status: 500 },
    );
  }

  const allCategories = categoriesResult.data;
  const inventory = inventoryResult.data;

  // Filter categories if specified
  const filteredCategories = categoryIds?.length
    ? allCategories.filter((c) => categoryIds.includes(c.id))
    : allCategories;

  const categoryNameFilter = filteredCategories.map((c) => c.name);

  // Build inventory snapshot
  const inventorySnapshot: Record<string, number> = {};
  inventory.forEach((item) => {
    inventorySnapshot[item.ingredient.name] = item.quantity;
  });

  // Call DeepSeek
  const systemPrompt = buildSystemPrompt(allCategories);
  const userPrompt = buildUserPrompt(
    inventory,
    targetMeals as MealType[],
    note,
    categoryNameFilter,
  );

  let aiResult;
  try {
    aiResult = await generateMeals(systemPrompt, userPrompt);
  } catch (err) {
    return NextResponse.json(
      {
        error: `AI 生成失败: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from("meal_sessions")
    .insert({ note: note ?? null, inventory_snapshot: inventorySnapshot })
    .select()
    .single();

  if (sessionError)
    return NextResponse.json({ error: sessionError.message }, { status: 500 });

  // Build category name → id map
  const categoryMap = new Map(allCategories.map((c) => [c.name, c.id]));

  // Insert recommendations
  const toInsert = [];
  for (const mealType of targetMeals) {
    const dishes = aiResult[mealType as MealType] ?? [];
    for (const dish of dishes) {
      toInsert.push({
        session_id: session.id,
        meal_type: mealType,
        dish_name: dish.dishName,
        category_id: categoryMap.get(dish.categoryName) ?? null,
        description: dish.description ?? null,
        cooking_steps: dish.cookingSteps ?? null,
        ingredients_used: dish.ingredientsUsed ?? [],
        reference_links: buildReferenceLinks(dish.dishName),
      });
    }
  }

  const { data: recommendations, error: recError } = await supabase
    .from("meal_recommendations")
    .insert(toInsert)
    .select("*, category:dish_categories(*)");

  if (recError)
    return NextResponse.json({ error: recError.message }, { status: 500 });

  // Group by meal type
  const result: Record<string, unknown[]> = {};
  for (const mealType of targetMeals) {
    result[mealType] = recommendations.filter((r) => r.meal_type === mealType);
  }

  return NextResponse.json(
    { sessionId: session.id, ...result },
    { status: 201 },
  );
}
