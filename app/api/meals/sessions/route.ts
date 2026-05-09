import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_sessions")
    .select(
      "*, recommendations:meal_recommendations(*, category:dish_categories(*))",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
