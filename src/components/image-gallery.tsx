"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { ImagePreviewDialog } from "./image-preview-dialog";

interface ImageGalleryProps {
  storageIds: Id<"_storage">[];
  numberOfImages: number;
  prompt: string;
  model?: string;
  originalPrompt?: string;
  stylePreset?: string;
  styleSuffix?: string;
  wasEnhanced?: boolean;
  enhancedPrompt?: string;
  status?: string;
  error?: string;
}

export function ImageGallery({ storageIds, numberOfImages, prompt, model, originalPrompt, stylePreset, styleSuffix, wasEnhanced, enhancedPrompt, status, error }: ImageGalleryProps) {
  const urls = useQuery(api.generations.getImageUrls, {
    storageIds: storageIds.length > 0 ? storageIds : [],
  });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const validUrls = urls?.filter((url): url is string => url !== null) ?? [];
  const isFailed = status === "failed";
  const remainingSkeletons = isFailed ? 0 : numberOfImages - storageIds.length;
  const isStillGenerating = remainingSkeletons > 0;
  const cols = numberOfImages === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <>
      <div className={`grid gap-5 ${cols}`}>
        {/* Rendered images */}
        {storageIds.length > 0 && !urls ? (
          // URLs still loading for existing storage IDs
          storageIds.map((_, i) => (
            <div
              key={`loading-${i}`}
              className="aspect-square rounded-lg bg-muted animate-pulse"
            />
          ))
        ) : (
          validUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => setPreviewIndex(i)}
              className="group relative overflow-hidden rounded-lg bg-muted transition-all duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <img
                src={url}
                alt={`Generated: ${prompt}`}
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          ))
        )}

        {/* Skeleton placeholders for images still being generated */}
        {remainingSkeletons > 0 &&
          Array.from({ length: remainingSkeletons }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="aspect-square rounded-lg bg-muted animate-pulse flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                <svg
                  className="h-6 w-6 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-xs">
                  {storageIds.length + i + 1} / {numberOfImages}
                </span>
              </div>
            </div>
          ))}
      </div>

      {isFailed && validUrls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4 text-destructive/50"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-destructive">{error || "Generation failed"}</p>
        </div>
      )}

      {isStillGenerating && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Generating {storageIds.length} / {numberOfImages} images...
        </p>
      )}

      <ImagePreviewDialog
        urls={validUrls}
        currentIndex={previewIndex}
        prompt={prompt}
        model={model}
        originalPrompt={originalPrompt}
        stylePreset={stylePreset}
        styleSuffix={styleSuffix}
        wasEnhanced={wasEnhanced}
        enhancedPrompt={enhancedPrompt}
        onClose={() => setPreviewIndex(null)}
        onNavigate={setPreviewIndex}
      />
    </>
  );
}
