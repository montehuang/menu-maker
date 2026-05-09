"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { IngredientRow } from "@/components/ingredient-row";
import { toast } from "@/hooks/use-toast";
import { InventoryItem } from "@/types";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit dialog
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInventory = async () => {
    const res = await fetch("/api/inventory");
    const data = await res.json();
    setInventory(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleUpdate = async (ingredientId: string, quantity: number) => {
    const res = await fetch(`/api/inventory/${ingredientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      toast({ title: "更新失败", variant: "destructive" });
      return;
    }
    const updated = await res.json();
    setInventory((prev) =>
      prev.map((item) =>
        item.ingredient_id === ingredientId ? updated : item,
      ),
    );
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newUnit.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), unit: newUnit.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "添加失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setNewName("");
      setNewUnit("");
      setShowAdd(false);
      await fetchInventory();
      toast({ title: "添加成功", variant: "success" });
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditName(item.ingredient.name);
    setEditUnit(item.ingredient.unit);
  };

  const handleEdit = async () => {
    if (!editingItem || !editName.trim() || !editUnit.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ingredients/${editingItem.ingredient_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), unit: editUnit.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "修改失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setInventory((prev) =>
        prev.map((item) =>
          item.ingredient_id === editingItem.ingredient_id
            ? {
                ...item,
                ingredient: {
                  ...item.ingredient,
                  name: editName.trim(),
                  unit: editUnit.trim(),
                },
              }
            : item,
        ),
      );
      setEditingItem(null);
      toast({ title: "修改成功", variant: "success" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/ingredients/${deletingItem.ingredient_id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        toast({ title: "删除失败", variant: "destructive" });
        return;
      }
      setInventory((prev) =>
        prev.filter(
          (item) => item.ingredient_id !== deletingItem.ingredient_id,
        ),
      );
      setDeletingItem(null);
      toast({
        title: `「${deletingItem.ingredient.name}」已删除`,
        variant: "success",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = inventory.filter((item) =>
    item.ingredient.name.includes(search),
  );
  const inStock = filtered.filter((i) => i.quantity > 0);
  const outOfStock = filtered.filter((i) => i.quantity === 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          食材库存
        </h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/purchase">
              <ShoppingCart className="h-4 w-4" />
              采购入库
            </Link>
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            新增食材
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索食材…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search ? "未找到匹配食材" : "暂无食材，点击右上角新增"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inStock.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                有库存 ({inStock.length})
              </p>
              <div className="rounded-lg border bg-card divide-y">
                {inStock.map((item) => (
                  <IngredientRow
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdate}
                    onEdit={openEdit}
                    onDelete={setDeletingItem}
                  />
                ))}
              </div>
            </div>
          )}
          {outOfStock.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                已用完 ({outOfStock.length})
              </p>
              <div className="rounded-lg border bg-card divide-y opacity-60">
                {outOfStock.map((item) => (
                  <IngredientRow
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdate}
                    onEdit={openEdit}
                    onDelete={setDeletingItem}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增食材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>食材名称</Label>
              <Input
                placeholder="例：鸡蛋"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>单位</Label>
              <Input
                placeholder="例：个、克、毫升、根"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdd(false)}
              disabled={adding}
            >
              取消
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding || !newName.trim() || !newUnit.trim()}
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑食材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>食材名称</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>单位</Label>
              <Input
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingItem(null)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              onClick={handleEdit}
              disabled={saving || !editName.trim() || !editUnit.trim()}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除食材</DialogTitle>
            <DialogDescription>
              确定要删除「{deletingItem?.ingredient.name}
              」吗？相关库存记录也会一并删除，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
