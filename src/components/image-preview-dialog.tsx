"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  onClose,
  onNavigate,
}: ImagePreviewDialogProps) {
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
    a.download = `tarkan-${Date.now()}.png`;
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

        <img src={url} alt={`Generated: ${prompt}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />

        {hasMultiple && (
          <button onClick={goNext} disabled={!canNext}
            className={`absolute right-[340px] z-10 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center transition-opacity ${canNext ? "hover:bg-black/70 cursor-pointer" : "opacity-30 cursor-default"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        )}
      </div>

      {/* Sidebar */}
      <div className="relative w-80 bg-card border-l border-border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold">Details</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <Separator />

        <div className="flex-1 overflow-auto p-5 space-y-6">
          {/* Prompt Breakdown */}
          {hasBreakdown ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Prompt</p>
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

          {/* Settings */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settings</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded bg-muted text-xs text-muted-foreground">PNG</span>
              {model && (
                <span className="px-2.5 py-1 rounded bg-muted text-xs text-muted-foreground">{model}</span>
              )}
              {hasMultiple && (
                <span className="px-2.5 py-1 rounded bg-muted text-xs text-muted-foreground">{currentIndex! + 1} / {urls.length}</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-2 border-t border-border">
          <Button onClick={handleDownload} className="w-full" size="sm">Download</Button>
          <Button onClick={onClose} variant="outline" className="w-full" size="sm">Close</Button>
        </div>
      </div>
    </div>
  );
}
