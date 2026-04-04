"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface GenerationHistoryProps {
  selectedId: Id<"generations"> | null;
  onSelect: (
    id: Id<"generations">,
    storageIds: Id<"_storage">[],
    prompt: string
  ) => void;
}

export function GenerationHistory({
  selectedId,
  onSelect,
}: GenerationHistoryProps) {
  const generations = useQuery(api.generations.list);
  const removeGeneration = useMutation(api.generations.remove);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!generations) return;
    if (checkedIds.size === generations.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(generations.map((g) => g._id)));
    }
  };

  const deleteSelected = async () => {
    if (checkedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(
        Array.from(checkedIds).map((id) =>
          removeGeneration({ generationId: id as Id<"generations"> })
        )
      );
      setCheckedIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  if (!generations) {
    return (
      <div className="p-2 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center p-4">
        No generations yet.
      </p>
    );
  }

  const hasChecked = checkedIds.size > 0;
  const allChecked = checkedIds.size === generations.length;

  return (
    <div className="flex flex-col h-full">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={selectAll}
            className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
          />
          {hasChecked ? `${checkedIds.size} selected` : "Select all"}
        </label>
        {hasChecked && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={deleteSelected}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-1.5">
          {generations.map((gen, i) => (
            <div key={gen._id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() =>
                  onSelect(gen._id, gen.imageStorageIds, gen.prompt)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(gen._id, gen.imageStorageIds, gen.prompt);
                  }
                }}
                className={`flex items-start gap-3 rounded-lg px-4 py-3.5 transition-colors hover:bg-accent group cursor-pointer ${
                  selectedId === gen._id ? "bg-accent" : ""
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={checkedIds.has(gen._id)}
                  onChange={() => toggleChecked(gen._id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded border-border accent-primary mt-0.5 shrink-0 cursor-pointer"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{gen.prompt}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {gen.imageStorageIds.length}{" "}
                    {gen.imageStorageIds.length === 1 ? "image" : "images"}{" "}
                    &middot; {gen.aspectRatio}
                    {gen.model && <> &middot; {gen.model}</>}
                    {" "}&middot;{" "}
                    {new Date(gen.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {i < generations.length - 1 && <Separator className="my-1" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
