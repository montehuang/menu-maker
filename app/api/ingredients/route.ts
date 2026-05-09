import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(30),
  unit: z.string().min(1).max(10),
});

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  // Create ingredient
  const { data: ingredient, error: ingError } = await supabase
    .from("ingredients")
    .insert(parsed.data)
    .select()
    .single();

  if (ingError)
    return NextResponse.json({ error: ingError.message }, { status: 500 });

  // Initialize inventory entry at 0
  await supabase
    .from("inventory")
    .insert({ ingredient_id: ingredient.id, quantity: 0 });

  return NextResponse.json(ingredient, { status: 201 });
}
