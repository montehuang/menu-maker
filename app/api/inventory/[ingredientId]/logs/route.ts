import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ingredientId: string }> },
) {
  const { ingredientId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_logs")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
