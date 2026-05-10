import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  recommendationId: z.string().uuid(),
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

  const { recommendationId } = parsed.data;

  // Verify the recommendation is currently selected
  const { data: rec, error: recFetchError } = await supabase
    .from("meal_recommendations")
    .select("id, is_selected, dish_name")
    .eq("id", recommendationId)
    .single();

  if (recFetchError || !rec)
    return NextResponse.json({ error: "推荐记录不存在" }, { status: 404 });

  if (!rec.is_selected)
    return NextResponse.json({ error: "该菜品未被选中" }, { status: 400 });

  // Find all cook deduction logs for this recommendation
  const { data: logs, error: logError } = await supabase
    .from("inventory_logs")
    .select("ingredient_id, change_amount")
    .eq("recommendation_id", recommendationId)
    .eq("change_type", "cook");

  if (logError)
    return NextResponse.json({ error: logError.message }, { status: 500 });

  // Restore inventory for each deduction
  const errors: string[] = [];
  for (const log of logs ?? []) {
    const restoreAmount = Math.abs(log.change_amount);
    if (restoreAmount <= 0) continue;

    const { data: current } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("ingredient_id", log.ingredient_id)
      .single();

    const { error: invErr } = await supabase
      .from("inventory")
      .update({ quantity: (current?.quantity ?? 0) + restoreAmount })
      .eq("ingredient_id", log.ingredient_id);

    if (invErr) {
      errors.push(invErr.message);
      continue;
    }

    // Record the reversal in logs
    await supabase.from("inventory_logs").insert({
      ingredient_id: log.ingredient_id,
      change_amount: restoreAmount,
      change_type: "manual",
      note: `取消选择「${rec.dish_name}」，库存还原`,
    });
  }

  if (errors.length > 0)
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });

  // Mark recommendation as unselected
  const { error: updateError } = await supabase
    .from("meal_recommendations")
    .update({ is_selected: false })
    .eq("id", recommendationId);

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
