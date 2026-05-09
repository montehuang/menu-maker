import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, Package, AlertTriangle, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatQuantity } from "@/lib/utils";
import { MealSession } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const [inventoryResult, sessionsResult] = await Promise.all([
    supabase
      .from("inventory")
      .select("*, ingredient:ingredients(*)")
      .order("ingredient(name)", { ascending: true }),
    supabase
      .from("meal_sessions")
      .select(
        "*, recommendations:meal_recommendations(*, category:dish_categories(*))",
      )
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const inventory = inventoryResult.data ?? [];
  const sessions = (sessionsResult.data ?? []) as MealSession[];

  const emptyItems = inventory.filter((item) => item.quantity === 0);
  const totalItems = inventory.length;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ChefHat className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">菜单助手</h1>
          <p className="text-sm text-muted-foreground">今天吃什么？</p>
        </div>
      </div>

      {/* Quick action */}
      <Button asChild size="lg" className="w-full h-14 text-base">
        <Link href="/recommend">
          <Sparkles className="h-5 w-5" />
          生成今日菜单
        </Link>
      </Button>

      {/* Inventory summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              库存概况
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inventory">管理</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">已录入食材</span>
            <span className="font-medium">{totalItems} 种</span>
          </div>
          {emptyItems.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
              <span>
                {emptyItems
                  .slice(0, 3)
                  .map((i) => i.ingredient.name)
                  .join("、")}
                {emptyItems.length > 3 && ` 等 ${emptyItems.length} 种`}
                食材已用完
              </span>
            </div>
          )}
          {/* Recent non-zero items */}
          <div className="flex flex-wrap gap-1 pt-1">
            {inventory
              .filter((i) => i.quantity > 0)
              .slice(0, 8)
              .map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {item.ingredient.name} {formatQuantity(item.quantity)}
                  {item.ingredient.unit}
                </span>
              ))}
            {inventory.filter((i) => i.quantity > 0).length > 8 && (
              <span className="text-xs text-muted-foreground self-center">
                …
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            近期记录
          </h2>
          {sessions.map((session) => {
            const selected =
              session.recommendations?.filter((r) => r.is_selected) ?? [];
            return (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(session.created_at)}
                    </span>
                    {session.note && (
                      <span className="text-xs text-muted-foreground italic">
                        "{session.note}"
                      </span>
                    )}
                  </div>
                  {selected.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selected.map((rec) => (
                        <Badge
                          key={rec.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {rec.meal_type === "lunch" ? "午" : "晚"}{" "}
                          {rec.dish_name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">未选择菜品</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/history">查看全部历史</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
