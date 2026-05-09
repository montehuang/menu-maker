"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Ingredient } from "@/types";

interface PurchaseItem {
  ingredientId: string;
  quantity: string;
}

export default function PurchasePage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([
    { ingredientId: "", quantity: "" },
  ]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/ingredients")
      .then((r) => r.json())
      .then((data) => {
        setIngredients(Array.isArray(data) ? data : []);
      });
  }, []);

  const addRow = () =>
    setItems((prev) => [...prev, { ingredientId: "", quantity: "" }]);

  const removeRow = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const updateRow = (index: number, field: keyof PurchaseItem, value: string) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  const getUnit = (ingredientId: string) =>
    ingredients.find((i) => i.id === ingredientId)?.unit ?? "";

  const handleSubmit = async () => {
    const validItems = items.filter(
      (item) => item.ingredientId && parseFloat(item.quantity) > 0,
    );
    if (validItems.length === 0) {
      toast({ title: "请至少填写一项食材和数量", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/inventory/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: parseFloat(item.quantity),
          })),
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "入库失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: `已入库 ${validItems.length} 种食材`,
        variant: "success",
      });
      router.push("/inventory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        采购入库
      </h1>

      <div className="space-y-3">
        {items.map((item, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">食材</Label>
                  <select
                    value={item.ingredientId}
                    onChange={(e) =>
                      updateRow(index, "ingredientId", e.target.value)
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">选择食材…</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}（{ing.unit}）
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28 space-y-1.5">
                  <Label className="text-xs">
                    数量{" "}
                    {item.ingredientId && (
                      <span className="text-muted-foreground">
                        ({getUnit(item.ingredientId)})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={item.quantity}
                    onChange={(e) =>
                      updateRow(index, "quantity", e.target.value)
                    }
                    className="text-right"
                  />
                </div>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeRow(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addRow} className="w-full">
        <Plus className="h-4 w-4" />
        添加一行
      </Button>

      <div className="space-y-1.5">
        <Label>备注（可选）</Label>
        <Textarea
          placeholder="例：2026-05-09 超市采购"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full h-11">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        确认入库
      </Button>
    </div>
  );
}
