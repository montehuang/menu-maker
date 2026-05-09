"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Video,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealSession, MealRecommendation } from "@/types";
import { formatDate } from "@/lib/utils";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<MealSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meals/sessions")
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        历史记录
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">还没有生成记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: MealSession }) {
  const [expanded, setExpanded] = useState(false);
  const lunch =
    session.recommendations?.filter((r) => r.meal_type === "lunch") ?? [];
  const dinner =
    session.recommendations?.filter((r) => r.meal_type === "dinner") ?? [];
  const selected = session.recommendations?.filter((r) => r.is_selected) ?? [];
  const hasUnselected =
    session.recommendations?.some((r) => !r.is_selected) ?? false;
  const totalCount = lunch.length + dinner.length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDate(session.created_at)}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {session.note && (
              <span className="text-xs text-muted-foreground italic truncate max-w-[120px]">
                "{session.note}"
              </span>
            )}
            {hasUnselected && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
              >
                <Link href={`/recommend?session=${session.id}`}>
                  继续选择
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Selected dishes summary */}
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selected.map((rec) => (
              <Badge key={rec.id} variant="success" className="text-xs">
                {rec.meal_type === "lunch" ? "午" : "晚"} {rec.dish_name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">未选择任何菜品</p>
        )}

        {/* Expand toggle */}
        {totalCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? "收起" : `查看全部推荐（共 ${totalCount} 道）`}
          </button>
        )}

        {expanded && (
          <div className="space-y-4 pt-1">
            {lunch.length > 0 && (
              <MealGroup label="午饭" recommendations={lunch} />
            )}
            {dinner.length > 0 && (
              <MealGroup label="晚饭" recommendations={dinner} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MealGroup({
  label,
  recommendations,
}: {
  label: string;
  recommendations: MealRecommendation[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {recommendations.map((rec) => (
        <RecipeRow key={rec.id} rec={rec} />
      ))}
    </div>
  );
}

function RecipeRow({ rec }: { rec: MealRecommendation }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${rec.is_selected ? "border-green-300 bg-green-50/40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{rec.dish_name}</span>
          {rec.category && (
            <Badge variant="secondary" className="text-xs">
              {rec.category.name}
            </Badge>
          )}
          {rec.is_selected && (
            <Badge variant="success" className="text-xs">
              已选
            </Badge>
          )}
        </div>
        {rec.cooking_steps && (
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-primary hover:underline shrink-0"
          >
            {open ? "收起" : "做法"}
          </button>
        )}
      </div>
      {rec.description && (
        <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
      )}
      {open && rec.cooking_steps && (
        <div className="mt-2 border-t pt-2 space-y-2">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
            {rec.cooking_steps}
          </pre>
          {rec.reference_links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {rec.reference_links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  {link.type === "video" ? (
                    <Video className="h-3 w-3 text-red-500" />
                  ) : (
                    <BookOpen className="h-3 w-3 text-blue-500" />
                  )}
                  {link.platform}
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
