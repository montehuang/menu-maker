"use client";

import { useState } from "react";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Video,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MealRecommendation } from "@/types";
import { cn } from "@/lib/utils";

interface DishCardProps {
  recommendation: MealRecommendation;
  onSelect: (recommendation: MealRecommendation) => void;
  disabled?: boolean;
}

export function DishCard({
  recommendation,
  onSelect,
  disabled,
}: DishCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "transition-all",
        recommendation.is_selected && "border-green-400 bg-green-50/50",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">
                {recommendation.dish_name}
              </h3>
              {recommendation.category && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {recommendation.category.name}
                </Badge>
              )}
              {recommendation.is_selected && (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              )}
            </div>
            {recommendation.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {recommendation.description}
              </p>
            )}
          </div>
        </div>

        {/* Ingredients needed */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1">所需食材</p>
          <div className="flex flex-wrap gap-1">
            {recommendation.ingredients_used.map((ing, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {ing.name} × {ing.quantity}
                {ing.unit}
              </span>
            ))}
          </div>
        </div>

        {/* Expandable recipe steps */}
        {recommendation.cooking_steps && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {expanded ? "收起做法" : "查看做法"}
            </button>
            {expanded && (
              <>
                <Separator className="my-3" />
                <div className="prose prose-sm max-w-none text-sm">
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                    {recommendation.cooking_steps}
                  </pre>
                </div>

                {/* Reference links */}
                {recommendation.reference_links.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      参考资料
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recommendation.reference_links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
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
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Action */}
        {!recommendation.is_selected && (
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={() => onSelect(recommendation)}
            disabled={disabled}
          >
            选这个
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
