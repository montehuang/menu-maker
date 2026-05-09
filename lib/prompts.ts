import { InventoryItem, DishCategory, MealType } from "@/types";

export function buildSystemPrompt(categories: DishCategory[]): string {
  const categoryNames = categories.map((c) => c.name).join("、");
  return `你是一位专业的家庭厨师顾问。用户会告诉你当前冰箱里的食材库存，你需要根据库存推荐适合的菜品。

要求：
- 优先使用库存中数量充足的食材
- 推荐的菜品要营养搭配合理，午饭和晚饭不重复
- 做法描述要清晰、实用，适合家庭烹饪水平
- 每道菜的 cookingSteps 使用中文 Markdown 格式，包含详细步骤
- ingredientsUsed 中每种食材的 unit 必须与库存列表里该食材的单位完全一致，不得自行换算或更换单位
- 必须严格按照 JSON 格式输出，不要有多余内容，不要有 markdown 代码块包裹

可用菜品分类：${categoryNames || "中餐、西餐、快手菜"}`;
}

export function buildUserPrompt(
  inventory: InventoryItem[],
  targetMeals: MealType[],
  note?: string,
  categoryNames?: string[],
): string {
  const inventoryList = inventory
    .filter((item) => item.quantity > 0)
    .map(
      (item) =>
        `- ${item.ingredient.name}：${item.quantity} ${item.ingredient.unit}`,
    )
    .join("\n");

  const mealRequest = targetMeals
    .map((m) => (m === "lunch" ? "午饭：3 道候选菜" : "晚饭：3 道候选菜"))
    .join("\n- ");

  const categoryFilter =
    categoryNames && categoryNames.length > 0
      ? `\n菜品分类限定：${categoryNames.join("、")}`
      : "";

  const noteStr = note ? `\n额外要求：${note}` : "";

  const mealKeys = targetMeals.map((m) => (m === "lunch" ? "lunch" : "dinner"));
  const schemaExample = mealKeys
    .map(
      (key) =>
        `"${key}": [
    {
      "dishName": "菜品名称",
      "categoryName": "分类名称",
      "description": "一句话描述",
      "ingredientsUsed": [{"name": "食材名", "quantity": 2, "unit": "个"}],
      "cookingSteps": "## 做法\\n1. 步骤一...\\n2. 步骤二..."
    }
  ]`,
    )
    .join(",\n  ");

  return `当前食材库存：
${inventoryList || "（库存为空）"}
${categoryFilter}
请为今天推荐：
- ${mealRequest}
${noteStr}

请严格按以下 JSON 格式输出：
{
  ${schemaExample}
}`;
}
