"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DishCard } from "@/components/dish-card";
import { DeductionDialog } from "@/components/deduction-dialog";
import { toast } from "@/hooks/use-toast";
import {
  MealRecommendation,
  InventoryItem,
  DishCategory,
  MealSession,
} from "@/types";
import { cn, formatDate } from "@/lib/utils";

// Wrap in Suspense so useSearchParams works correctly in Next.js App Router
export default function RecommendPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecommendPageInner />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div className="h-7 w-32 rounded bg-muted animate-pulse" />
      <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

function RecommendPageInner() {
  const searchParams = useSearchParams();

  const [note, setNote] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoredSession, setRestoredSession] = useState<MealSession | null>(
    null,
  );
  const [lunch, setLunch] = useState<MealRecommendation[]>([]);
  const [dinner, setDinner] = useState<MealRecommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<"lunch" | "dinner" | null>(
    null,
  );
  const [pendingRec, setPendingRec] = useState<MealRecommendation | null>(null);

  // Load categories, inventory, and attempt session restore on mount
  useEffect(() => {
    const init = async () => {
      const [cats, inv] = await Promise.all([
        fetch("/api/categories").then((r) => r.json()),
        fetch("/api/inventory").then((r) => r.json()),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setInventory(Array.isArray(inv) ? inv : []);

      // Try to restore session
      const sessionParam = searchParams.get("session");
      if (sessionParam) {
        await loadSession(sessionParam);
      } else {
        await loadTodaySession();
      }

      setInitialLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSession = async (id: string) => {
    const res = await fetch(`/api/meals/sessions/${id}`);
    if (!res.ok) return;
    const session: MealSession = await res.json();
    applySession(session);
  };

  const loadTodaySession = async () => {
    const res = await fetch("/api/meals/sessions");
    if (!res.ok) return;
    const sessions: MealSession[] = await res.json();
    if (!sessions.length) return;

    const latest = sessions[0];
    const isToday =
      new Date(latest.created_at).toDateString() === new Date().toDateString();
    if (!isToday) return;

    const hasUnselected = latest.recommendations?.some((r) => !r.is_selected);
    if (!hasUnselected) return;

    applySession(latest);
  };

  const applySession = (session: MealSession) => {
    setSessionId(session.id);
    setRestoredSession(session);
    setLunch(
      session.recommendations?.filter((r) => r.meal_type === "lunch") ?? [],
    );
    setDinner(
      session.recommendations?.filter((r) => r.meal_type === "dinner") ?? [],
    );
  };

  const clearSession = () => {
    setSessionId(null);
    setRestoredSession(null);
    setLunch([]);
    setDinner([]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/meals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || undefined,
          categoryIds: selectedCategoryIds.length
            ? selectedCategoryIds
            : undefined,
          targetMeals: ["lunch", "dinner"],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "生成失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setSessionId(data.sessionId);
      setRestoredSession(null);
      setLunch(data.lunch ?? []);
      setDinner(data.dinner ?? []);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (mealType: "lunch" | "dinner") => {
    if (!sessionId) return;
    setRegenerating(mealType);
    try {
      const res = await fetch("/api/meals/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mealType,
          note: note || undefined,
          categoryIds: selectedCategoryIds.length
            ? selectedCategoryIds
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "换批失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setRestoredSession(null);
      if (mealType === "lunch") setLunch(data.lunch ?? []);
      else setDinner(data.dinner ?? []);
    } finally {
      setRegenerating(null);
    }
  };

  const handleSelect = (rec: MealRecommendation) => setPendingRec(rec);

  const handleConfirmDeduction = async (
    recommendationId: string,
    deductions: { ingredientId: string; quantity: number }[],
  ) => {
    const res = await fetch("/api/meals/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId, deductions }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "操作失败",
        description: data.error,
        variant: "destructive",
      });
      return;
    }

    const markSelected = (recs: MealRecommendation[]) =>
      recs.map((r) =>
        r.id === recommendationId ? { ...r, is_selected: true } : r,
      );
    setLunch(markSelected);
    setDinner(markSelected);

    const inv = await fetch("/api/inventory").then((r) => r.json());
    setInventory(Array.isArray(inv) ? inv : []);

    toast({
      title: "已选定",
      description: `${pendingRec?.dish_name} 食材已扣除`,
      variant: "success",
    });
  };

  const toggleCategory = (id: string) =>
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const hasResults = lunch.length > 0 || dinner.length > 0;

  if (initialLoading) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI 菜品推荐
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && "bg-muted")}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Restored session banner */}
      {restoredSession && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 text-blue-700 min-w-0">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              已恢复 · {formatDate(restoredSession.created_at)}
            </span>
          </div>
          <button
            onClick={clearSession}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0 hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            清除
          </button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              备注（口味偏好等）
            </Label>
            <Textarea
              placeholder="例：今天不想吃辣，想清淡一点"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              菜品分类（不选则不限）
            </Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    selectedCategoryIds.includes(cat.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating}
        size="lg"
        className="w-full h-12 text-base"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 正在生成推荐…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {hasResults ? "重新生成全部" : "生成今日菜单"}
          </>
        )}
      </Button>

      {/* Results */}
      {hasResults && (
        <div className="space-y-8">
          <MealSection
            title="午饭推荐"
            emoji="🍱"
            recommendations={lunch}
            onSelect={handleSelect}
            onRegenerate={() => handleRegenerate("lunch")}
            regenerating={regenerating === "lunch"}
          />
          <MealSection
            title="晚饭推荐"
            emoji="🍽️"
            recommendations={dinner}
            onSelect={handleSelect}
            onRegenerate={() => handleRegenerate("dinner")}
            regenerating={regenerating === "dinner"}
          />
        </div>
      )}

      <DeductionDialog
        open={!!pendingRec}
        onOpenChange={(open) => !open && setPendingRec(null)}
        recommendation={pendingRec}
        inventory={inventory}
        onConfirm={handleConfirmDeduction}
      />
    </div>
  );
}

function MealSection({
  title,
  emoji,
  recommendations,
  onSelect,
  onRegenerate,
  regenerating,
}: {
  title: string;
  emoji: string;
  recommendations: MealRecommendation[];
  onSelect: (rec: MealRecommendation) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const hasSelected = recommendations.some((r) => r.is_selected);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-1.5">
          <span>{emoji}</span>
          {title}
          {hasSelected && (
            <Badge variant="success" className="text-xs">
              已选
            </Badge>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="h-8 text-xs"
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          换一批
        </Button>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <DishCard
            key={rec.id}
            recommendation={rec}
            onSelect={onSelect}
            disabled={regenerating}
          />
        ))}
      </div>
    </div>
  );
}
