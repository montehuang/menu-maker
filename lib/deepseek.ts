import { MealType, IngredientUsed } from "@/types";

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

interface RawDish {
  dishName: string;
  categoryName: string;
  description: string;
  ingredientsUsed: IngredientUsed[];
  cookingSteps: string;
}

export interface DeepSeekMealResult {
  lunch?: RawDish[];
  dinner?: RawDish[];
}

export async function generateMeals(
  systemPrompt: string,
  userPrompt: string,
): Promise<DeepSeekMealResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Strip possible markdown code fences
  const clean = content
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: DeepSeekMealResult;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(
      `Failed to parse DeepSeek response as JSON: ${clean.slice(0, 300)}`,
    );
  }

  validateMealResult(parsed);
  return parsed;
}

function validateMealResult(
  result: unknown,
): asserts result is DeepSeekMealResult {
  if (typeof result !== "object" || result === null) {
    throw new Error("AI response is not an object");
  }
  const obj = result as Record<string, unknown>;
  for (const key of ["lunch", "dinner"]) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      throw new Error(`AI response.${key} is not an array`);
    }
  }
}

export function parseMealType(key: string): MealType {
  if (key === "lunch" || key === "dinner") return key;
  throw new Error(`Unknown meal type: ${key}`);
}
