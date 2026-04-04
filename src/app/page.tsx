"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PromptForm } from "@/components/prompt-form";
import { ImageGallery } from "@/components/image-gallery";
import { GenerationHistory } from "@/components/generation-history";

export default function Home() {
  const [selectedId, setSelectedId] = useState<Id<"generations"> | null>(null);

  const generations = useQuery(api.generations.list);
  const prevCountRef = useRef<number | undefined>(undefined);

  // Auto-select the latest generation when a new one appears
  useEffect(() => {
    if (!generations) return;

    const currentCount = generations.length;
    if (
      prevCountRef.current !== undefined &&
      currentCount > prevCountRef.current &&
      generations[0]
    ) {
      setSelectedId(generations[0]._id);
    }
    prevCountRef.current = currentCount;
  }, [generations]);

  // Get the selected generation reactively from the query
  const selectedGeneration = useMemo(() => {
    if (!selectedId || !generations) return null;
    return generations.find((g) => g._id === selectedId) ?? null;
  }, [selectedId, generations]);

  const handleGenerated = (_generationId: Id<"generations">) => {
    // Auto-selection handled by the useEffect above
  };

  const handleSelectGeneration = (
    id: Id<"generations">,
    _storageIds: Id<"_storage">[],
    _prompt: string
  ) => {
    setSelectedId(id);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar 1: Logo + Create */}
      <div className="w-[420px] shrink-0 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <path d="M15 8h.01" />
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m2 20 5.586-5.586a2 2 0 0 1 2.828 0L16 20" />
              <path d="m14 16 2.586-2.586a2 2 0 0 1 2.828 0L22 16" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">Tarkan</h1>
            <p className="text-[10px] text-muted-foreground">AI Image Generator</p>
          </div>
        </div>

        {/* Create Form */}
        <div className="flex-1 overflow-auto p-7">
          <PromptForm onGenerated={handleGenerated} />
        </div>
      </div>

      {/* Sidebar 2: History */}
      <div className="w-96 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-sm font-semibold">History</h2>
          {generations && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {generations.reduce((sum, g) => sum + g.imageStorageIds.length, 0)} images &middot; {generations.length} runs
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <GenerationHistory
            selectedId={selectedId}
            onSelect={handleSelectGeneration}
          />
        </div>
      </div>

      {/* Main: Result / Gallery */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Gallery Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold truncate">
            {selectedGeneration ? selectedGeneration.prompt : "Gallery"}
          </h2>
          {selectedGeneration?.model && (
            <span className="text-[11px] text-muted-foreground shrink-0 px-2 py-0.5 rounded bg-muted">
              {selectedGeneration.model}
            </span>
          )}
        </div>

        {/* Gallery Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedGeneration ? (
            <ImageGallery
              storageIds={selectedGeneration.imageStorageIds}
              numberOfImages={selectedGeneration.numberOfImages}
              prompt={selectedGeneration.prompt}
              model={selectedGeneration.model}
              originalPrompt={selectedGeneration.originalPrompt}
              stylePreset={selectedGeneration.stylePreset}
              styleSuffix={selectedGeneration.styleSuffix}
              wasEnhanced={selectedGeneration.wasEnhanced}
              enhancedPrompt={selectedGeneration.enhancedPrompt}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-4 opacity-50"
              >
                <path d="M15 8h.01" />
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m2 20 5.586-5.586a2 2 0 0 1 2.828 0L16 20" />
                <path d="m14 16 2.586-2.586a2 2 0 0 1 2.828 0L22 16" />
              </svg>
              <p className="text-sm">Generate or select an image to view it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
