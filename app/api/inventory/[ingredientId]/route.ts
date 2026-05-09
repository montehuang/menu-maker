import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateSchema = z.object({
  quantity: z.number().min(0),
  note: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ingredientId: string }> },
) {
  const { ingredientId } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  // Get current quantity for log
  const { data: current } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("ingredient_id", ingredientId)
    .single();

  const { data, error } = await supabase
    .from("inventory")
    .update({ quantity: parsed.data.quantity })
    .eq("ingredient_id", ingredientId)
    .select("*, ingredient:ingredients(*)")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Write log
  const changeAmount = parsed.data.quantity - (current?.quantity ?? 0);
  await supabase.from("inventory_logs").insert({
    ingredient_id: ingredientId,
    change_amount: changeAmount,
    change_type: "manual",
    note: parsed.data.note ?? "手动修改",
  });

  return NextResponse.json(data);
}
