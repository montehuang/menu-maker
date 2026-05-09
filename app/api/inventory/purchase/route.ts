import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const purchaseSchema = z.object({
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.number().positive(),
      }),
    )
    .min(1),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { items, note } = parsed.data;
  const errors: string[] = [];

  for (const item of items) {
    // Upsert inventory
    const { data: current } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("ingredient_id", item.ingredientId)
      .single();

    const newQuantity = (current?.quantity ?? 0) + item.quantity;

    const { error: invError } = await supabase
      .from("inventory")
      .upsert(
        { ingredient_id: item.ingredientId, quantity: newQuantity },
        { onConflict: "ingredient_id" },
      );

    if (invError) {
      errors.push(invError.message);
      continue;
    }

    await supabase.from("inventory_logs").insert({
      ingredient_id: item.ingredientId,
      change_amount: item.quantity,
      change_type: "purchase",
      note: note ?? "采购入库",
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
