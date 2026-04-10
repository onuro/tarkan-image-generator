"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateGenerationCost } from "@/lib/pricing";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 50;

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 60) return "last month";
  return `${Math.floor(days / 30)}mo ago`;
}

function HistoryThumbnails({
  storageIds,
  totalExpected,
  isGenerating,
}: {
  storageIds: Id<"_storage">[];
  totalExpected: number;
  isGenerating: boolean;
}) {
  const previewIds = storageIds.slice(0, 4);
  const urls = useQuery(api.generations.getImageUrls, {
    storageIds: previewIds,
  });
  const validUrls = urls?.filter((u): u is string => u !== null) ?? [];

  const previewTotal = Math.min(totalExpected, 4);
  const pendingCount = isGenerating ? Math.max(0, previewTotal - validUrls.length) : 0;

  if (validUrls.length === 0 && pendingCount === 0) return null;

  const gridClass = previewTotal === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-0.5 w-16 h-16 shrink-0 rounded-md overflow-hidden`}>
      {validUrls.map((url, i) => (
        <Image
          key={i}
          src={url}
          alt=""
          width={32}
          height={32}
          className="w-full h-full object-cover"
        />
      ))}
      {Array.from({ length: pendingCount }, (_, i) => (
        <div
          key={`pending-${i}`}
          className="w-full h-full bg-foreground/10 animate-pulse"
        />
      ))}
    </div>
  );
}

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
  const [currentPage, setCurrentPage] = useState(1);

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
    if (!pageItems) return;
    if (checkedIds.size === pageItems.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(pageItems.map((g) => g._id)));
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

  const totalPages = Math.ceil(generations.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = generations.slice(startIdx, startIdx + PAGE_SIZE);

  const hasChecked = checkedIds.size > 0;
  const allChecked = pageItems.length > 0 && checkedIds.size === pageItems.length;

  // Build page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 4) pages.push("ellipsis");
      const start = Math.max(2, safePage - 2);
      const end = Math.min(totalPages - 1, safePage + 2);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 3) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Bulk actions bar */}
      <div className="flex items-center justify-between pl-8 pr-8 pt-7 pb-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground cursor-pointer select-none h-6">
          <Checkbox
            size="lg"
            checked={allChecked}
            onChange={selectAll}
          />
          {hasChecked ? `${checkedIds.size} selected` : "Select all"}
        </div>
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
      <div className="flex-1 overflow-auto px-4 pb-4 pt-2">
        <div className="space-y-3">
          {pageItems.map((gen) => (
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
                className={`flex items-start gap-4 rounded-lg px-4 py-4 transition-colors group cursor-pointer ${selectedId === gen._id ? "bg-card dark:bg-accent" : "hover:bg-background dark:hover:bg-accent"
                  }`}
              >
                {/* Thumbnails + Checkbox overlay */}
                <div className="relative shrink-0">
                  {(gen.imageStorageIds.length > 0 || gen.status === "generating") ? (
                    <HistoryThumbnails
                      storageIds={gen.imageStorageIds}
                      totalExpected={gen.numberOfImages}
                      isGenerating={gen.status === "generating"}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-foreground/10" />
                  )}
                  <div
                    className={`absolute top-1 left-1 z-10 cursor-pointer transition-opacity ${checkedIds.has(gen._id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"} [&>span]:border-0 ${checkedIds.has(gen._id) ? "" : "[&>span]:bg-background/70 [&>span]:backdrop-blur-sm"}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      size="lg"
                      checked={checkedIds.has(gen._id)}
                      onChange={() => toggleChecked(gen._id)}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{gen.prompt}</p>
                  {gen.status === "failed" ? (
                    <p className="text-xs text-destructive mt-1 line-clamp-2">
                      {gen.error || "Failed"}
                    </p>
                  ) : gen.status === "generating" ? (
                    <p className="text-xs text-yellow-500 mt-1">Generating...</p>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>
                        {gen.aspectRatio}
                        {gen.model && <> &middot; {gen.model}</>}
                        {gen.provider === "vertex" && <> &middot; <span className="text-blue-400">Vertex</span></>}
                      </p>
                      <p>
                        {gen.promptTokens != null && (
                          <>{gen.promptTokens.toLocaleString()} tokens &middot; </>
                        )}
                        {`$${calculateGenerationCost(gen.model, gen.promptTokens, gen.imageStorageIds.length).toFixed(3)}`}
                        {" "}&middot;{" "}
                        {timeAgo(gen.createdAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0 border-t border-border/50 px-4 py-3">
          <Pagination>
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  text=""
                  className={safePage <= 1 ? "pointer-events-none opacity-40" : ""}
                  onClick={(e) => { e.preventDefault(); setCurrentPage(Math.max(1, safePage - 1)); }}
                  href="#"
                />
              </PaginationItem>
              {getPageNumbers().map((p, i) =>
                p === "ellipsis" ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis className="text-muted-foreground" />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === safePage}
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p); }}
                      href="#"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  text=""
                  className={safePage >= totalPages ? "pointer-events-none opacity-40" : ""}
                  onClick={(e) => { e.preventDefault(); setCurrentPage(Math.min(totalPages, safePage + 1)); }}
                  href="#"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
