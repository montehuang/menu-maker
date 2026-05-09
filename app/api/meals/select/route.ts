import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const selectSchema = z.object({
  recommendationId: z.string().uuid(),
  deductions: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.number().min(0),
    }),
  ),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = selectSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { recommendationId, deductions } = parsed.data;

  // Mark recommendation as selected
  const { error: recError } = await supabase
    .from("meal_recommendations")
    .update({ is_selected: true })
    .eq("id", recommendationId);

  if (recError)
    return NextResponse.json({ error: recError.message }, { status: 500 });

  // Apply deductions
  const errors: string[] = [];
  for (const deduction of deductions) {
    if (deduction.quantity <= 0) continue;

    const { data: current } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("ingredient_id", deduction.ingredientId)
      .single();

    const newQty = Math.max(0, (current?.quantity ?? 0) - deduction.quantity);

    const { error: invErr } = await supabase
      .from("inventory")
      .update({ quantity: newQty })
      .eq("ingredient_id", deduction.ingredientId);

    if (invErr) {
      errors.push(invErr.message);
      continue;
    }

    await supabase.from("inventory_logs").insert({
      ingredient_id: deduction.ingredientId,
      change_amount: -deduction.quantity,
      change_type: "cook",
      recommendation_id: recommendationId,
      note: "烹饪扣除",
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
