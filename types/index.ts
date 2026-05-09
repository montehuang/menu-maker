export type MealType = "lunch" | "dinner";
export type ChangeType = "purchase" | "cook" | "manual" | "expire";

export interface DishCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  ingredient_id: string;
  quantity: number;
  updated_at: string;
  ingredient: Ingredient;
}

export interface InventoryLog {
  id: string;
  ingredient_id: string;
  change_amount: number;
  change_type: ChangeType;
  recommendation_id: string | null;
  note: string | null;
  created_at: string;
  ingredient?: Ingredient;
}

export interface MealSession {
  id: string;
  note: string | null;
  inventory_snapshot: Record<string, number> | null;
  created_at: string;
  recommendations?: MealRecommendation[];
}

export interface ReferenceLink {
  platform: string;
  title: string;
  url: string;
  type: "article" | "video";
}

export interface IngredientUsed {
  name: string;
  quantity: number;
  unit: string;
  ingredientId?: string;
}

export interface MealRecommendation {
  id: string;
  session_id: string;
  meal_type: MealType;
  dish_name: string;
  category_id: string | null;
  description: string | null;
  cooking_steps: string | null;
  ingredients_used: IngredientUsed[];
  reference_links: ReferenceLink[];
  is_selected: boolean;
  created_at: string;
  category?: DishCategory;
}

export interface GenerateRequest {
  note?: string;
  categoryIds?: string[];
  targetMeals?: MealType[];
}

export interface RegenerateRequest {
  sessionId: string;
  mealType: MealType;
  note?: string;
  categoryIds?: string[];
}

export interface DeductionItem {
  ingredientId: string;
  quantity: number;
}

export interface SelectMealRequest {
  recommendationId: string;
  deductions: DeductionItem[];
}
