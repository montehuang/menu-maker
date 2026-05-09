import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateMeals } from "@/lib/deepseek";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { buildReferenceLinks } from "@/lib/reference-links";
import { MealType } from "@/types";

const schema = z.object({
  sessionId: z.string().uuid(),
  mealType: z.enum(["lunch", "dinner"]),
  note: z.string().max(200).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { sessionId, mealType, note, categoryIds } = parsed.data;

  const [categoriesResult, inventoryResult] = await Promise.all([
    supabase.from("dish_categories").select("*").order("sort_order"),
    supabase
      .from("inventory")
      .select("*, ingredient:ingredients(*)")
      .gt("quantity", 0),
  ]);

  if (categoriesResult.error || inventoryResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }

  const allCategories = categoriesResult.data;
  const inventory = inventoryResult.data;
  const filteredCategories = categoryIds?.length
    ? allCategories.filter((c) => categoryIds.includes(c.id))
    : allCategories;

  const systemPrompt = buildSystemPrompt(allCategories);
  const userPrompt = buildUserPrompt(
    inventory,
    [mealType as MealType],
    note,
    filteredCategories.map((c) => c.name),
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

  // Delete old non-selected recommendations for this meal type in the session
  await supabase
    .from("meal_recommendations")
    .delete()
    .eq("session_id", sessionId)
    .eq("meal_type", mealType)
    .eq("is_selected", false);

  const categoryMap = new Map(allCategories.map((c) => [c.name, c.id]));
  const dishes = aiResult[mealType as MealType] ?? [];

  const toInsert = dishes.map((dish) => ({
    session_id: sessionId,
    meal_type: mealType,
    dish_name: dish.dishName,
    category_id: categoryMap.get(dish.categoryName) ?? null,
    description: dish.description ?? null,
    cooking_steps: dish.cookingSteps ?? null,
    ingredients_used: dish.ingredientsUsed ?? [],
    reference_links: buildReferenceLinks(dish.dishName),
  }));

  const { data: recommendations, error } = await supabase
    .from("meal_recommendations")
    .insert(toInsert)
    .select("*, category:dish_categories(*)");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId, [mealType]: recommendations });
}
