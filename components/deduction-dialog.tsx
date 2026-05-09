"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MealRecommendation, InventoryItem, DeductionItem } from "@/types";
import { formatQuantity } from "@/lib/utils";

interface DeductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: MealRecommendation | null;
  inventory: InventoryItem[];
  onConfirm: (
    recommendationId: string,
    deductions: DeductionItem[],
  ) => Promise<void>;
}

export function DeductionDialog({
  open,
  onOpenChange,
  recommendation,
  inventory,
  onConfirm,
}: DeductionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  if (!recommendation) return null;

  const deductionRows = recommendation.ingredients_used.map((ing) => {
    const inv = inventory.find(
      (item) => item.ingredient.name.trim() === ing.name.trim(),
    );
    // Always use the unit from the user's ingredient definition, not the AI's suggestion.
    // Only pre-fill the AI's quantity when units match; otherwise leave blank to force manual input.
    const actualUnit = inv?.ingredient.unit ?? ing.unit;
    const unitsMatch = !inv || ing.unit.trim() === inv.ingredient.unit.trim();
    const defaultQty = unitsMatch ? String(ing.quantity) : "";
    const currentQty = quantities[ing.name] ?? defaultQty;
    const available = inv ? inv.quantity : 0;
    return { ing, inv, actualUnit, currentQty, available, unitsMatch };
  });

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const deductions: DeductionItem[] = deductionRows
        .filter((row) => row.inv)
        .map((row) => ({
          ingredientId: row.inv!.ingredient_id,
          quantity: parseFloat(row.currentQty) || 0,
        }))
        .filter((d) => d.quantity > 0);

      await onConfirm(recommendation.id, deductions);
      onOpenChange(false);
      setQuantities({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>确认选择：{recommendation.dish_name}</DialogTitle>
          <DialogDescription>
            以下食材将从库存中扣除，可手动调整数量
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {deductionRows.map(
            ({ ing, inv, actualUnit, currentQty, available, unitsMatch }) => (
              <div key={ing.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ing.name}</p>
                  <p className="text-xs text-muted-foreground">
                    库存：{inv ? formatQuantity(available) : "未录入"}{" "}
                    {actualUnit}
                  </p>
                  {!unitsMatch && inv && (
                    <p className="text-xs text-yellow-600">
                      AI 建议 {ing.quantity}
                      {ing.unit}，请按{actualUnit}手动输入
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={currentQty}
                    onChange={(e) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [ing.name]: e.target.value,
                      }))
                    }
                    className="w-20 h-8 text-sm text-right"
                    disabled={!inv}
                    placeholder={!unitsMatch && inv ? "请填写" : undefined}
                  />
                  <Label className="text-xs text-muted-foreground w-6">
                    {actualUnit}
                  </Label>
                </div>
              </div>
            ),
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            确认扣除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
