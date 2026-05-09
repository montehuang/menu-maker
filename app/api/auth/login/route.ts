import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 401 });

  return NextResponse.json({ success: true });
}
