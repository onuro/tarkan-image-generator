"use client";

import { useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { calculateGenerationCost } from "@/lib/pricing";

interface ImagePreviewDialogProps {
  urls: string[];
  currentIndex: number | null;
  prompt: string;
  model?: string;
  originalPrompt?: string;
  stylePreset?: string;
  styleSuffix?: string;
  wasEnhanced?: boolean;
  enhancedPrompt?: string;
  aspectRatio?: string;
  promptTokens?: number | null;
  imageCount?: number;
  thinkingLevel?: string;
  referenceUrls?: string[];
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImagePreviewDialog({
  urls,
  currentIndex,
  prompt,
  model,
  originalPrompt,
  stylePreset,
  styleSuffix,
  wasEnhanced,
  enhancedPrompt,
  aspectRatio,
  promptTokens,
  imageCount,
  thinkingLevel,
  referenceUrls,
  onClose,
  onNavigate,
}: ImagePreviewDialogProps) {
  const [copied, setCopied] = useState<"original" | "final" | false>(false);

  const copyText = (text: string, which: "original" | "final") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(false), 2000);
  };
  const isOpen = currentIndex !== null;
  const url = currentIndex !== null ? urls[currentIndex] : null;
  const canPrev = currentIndex !== null && currentIndex > 0;
  const canNext = currentIndex !== null && currentIndex < urls.length - 1;
  const hasMultiple = urls.length > 1;

  const goNext = useCallback(() => {
    if (canNext && currentIndex !== null) onNavigate(currentIndex + 1);
  }, [canNext, currentIndex, onNavigate]);

  const goPrev = useCallback(() => {
    if (canPrev && currentIndex !== null) onNavigate(currentIndex - 1);
  }, [canPrev, currentIndex, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goNext, goPrev]);

  if (!isOpen || !url) return null;

  const handleDownload = async () => {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `hadooken-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  // Determine which prompt parts to show
  const hasBreakdown = originalPrompt || stylePreset || wasEnhanced;
  const displayOriginal = originalPrompt || prompt;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Image area */}
      <div className="relative flex-1 flex items-center justify-center p-8">
        {hasMultiple && (
          <button onClick={goPrev} disabled={!canPrev}
            className={`absolute left-4 z-10 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center transition-opacity ${canPrev ? "hover:bg-black/70 cursor-pointer" : "opacity-30 cursor-default"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}

        <img src={url} alt={`Generated: ${prompt}`} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />

        {hasMultiple && (
          <button onClick={goNext} disabled={!canNext}
            className={`absolute right-4 z-10 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center transition-opacity ${canNext ? "hover:bg-black/70 cursor-pointer" : "opacity-30 cursor-default"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        )}
      </div>

      {/* Sidebar */}
      <div className="relative w-80 bg-card border-l border-border/50 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold">Details</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <Separator />

        <div className="flex-1 overflow-auto p-5 space-y-6">
          {/* Prompt Breakdown */}
          {hasBreakdown ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Prompt</p>
                  <button
                    onClick={() => copyText(displayOriginal, "original")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {copied === "original" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-sm leading-relaxed">{displayOriginal}</p>
              </div>

              {stylePreset && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider">
                    <span className="text-blue-400">+ Style: {stylePreset}</span>
                  </p>
                  {styleSuffix && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{styleSuffix}</p>
                  )}
                </div>
              )}

              {wasEnhanced && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider">
                    <span className="text-purple-400">+ AI Enhanced</span>
                  </p>
                  {enhancedPrompt && enhancedPrompt !== originalPrompt && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{enhancedPrompt}</p>
                  )}
                  {enhancedPrompt && enhancedPrompt === originalPrompt && (
                    <p className="text-xs text-muted-foreground/50 leading-relaxed italic">No changes — prompt was already specific</p>
                  )}
                </div>
              )}

              {!wasEnhanced && !stylePreset && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Final Prompt</p>
                  <p className="text-sm leading-relaxed">{prompt}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</p>
              <p className="text-sm leading-relaxed">{prompt}</p>
            </div>
          )}

          {/* Copy Prompt */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            {copied ? "Copied!" : "Copy final prompt"}
          </button>

          {/* Settings */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</p>
            <div className="space-y-2">
              {model && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Model</span>
                  <span>{model}</span>
                </div>
              )}
              {aspectRatio && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Aspect Ratio</span>
                  <span>{aspectRatio}</span>
                </div>
              )}
              {thinkingLevel && thinkingLevel !== "none" && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Thinking</span>
                  <span className="capitalize">{thinkingLevel}</span>
                </div>
              )}
              {promptTokens != null && promptTokens > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tokens</span>
                  <span>{promptTokens.toLocaleString()}</span>
                </div>
              )}
              {imageCount != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Images</span>
                  <span>{imageCount}</span>
                </div>
              )}
              {model && imageCount != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cost</span>
                  <span>${calculateGenerationCost(model, promptTokens ?? undefined, imageCount).toFixed(3)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Format</span>
                <span>PNG</span>
              </div>
              {hasMultiple && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Viewing</span>
                  <span>{currentIndex! + 1} / {urls.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reference Images */}
          {referenceUrls && referenceUrls.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">References used</p>
              <div className="flex gap-2 flex-wrap">
                {referenceUrls.map((refUrl, i) => (
                  <div key={i} className="space-y-1">
                    <div className="size-12 rounded-lg overflow-hidden border border-border/50 bg-muted">
                      <img src={refUrl} alt={`Ref @img${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center font-mono">@img{i + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-2 border-t border-border/50">
          <Button onClick={handleDownload} className="w-full" size="sm">Download</Button>
          <Button onClick={onClose} variant="outline" className="w-full" size="sm">Close</Button>
        </div>
      </div>
    </div>
  );
}
