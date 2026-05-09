"use client";

import { useState, useRef } from "react";
import {
  Check,
  Pencil,
  X,
  MoreVertical,
  Settings2,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InventoryItem } from "@/types";
import { formatQuantity, cn } from "@/lib/utils";

interface IngredientRowProps {
  item: InventoryItem;
  onUpdate: (ingredientId: string, quantity: number) => Promise<void>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  lowThreshold?: number;
}

export function IngredientRow({
  item,
  onUpdate,
  onEdit,
  onDelete,
  lowThreshold = 0,
}: IngredientRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(formatQuantity(item.quantity));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancel = () => {
    setEditing(false);
    setValue("");
  };

  const save = async () => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return cancel();
    setSaving(true);
    try {
      await onUpdate(item.ingredient_id, qty);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const isLow = item.quantity <= lowThreshold;

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.ingredient.name}</p>
        <p className="text-xs text-muted-foreground">{item.ingredient.unit}</p>
      </div>

      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <Input
            ref={inputRef}
            type="number"
            min="0"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            className="w-24 h-8 text-sm text-right"
            disabled={saving}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-green-600"
            onClick={save}
            disabled={saving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={cancel}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "text-sm font-semibold min-w-[3rem] text-right",
              isLow && "text-destructive",
            )}
          >
            {formatQuantity(item.quantity)}
          </span>
          <span className="text-xs text-muted-foreground w-6">
            {item.ingredient.unit}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Settings2 className="h-4 w-4" />
                编辑名称/单位
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
                删除食材
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
