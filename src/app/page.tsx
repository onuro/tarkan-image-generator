"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { calculateGenerationCost } from "@/lib/pricing";
import { PromptForm } from "@/components/prompt-form";
import { ImageGallery } from "@/components/image-gallery";
import { GenerationHistory } from "@/components/generation-history";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";

export default function Home() {
  const [selectedId, setSelectedId] = useState<Id<"generations"> | null>(null);

  // Provider state (lifted from PromptForm)
  const [provider, setProvider] = useState<"gemini" | "vertex">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("hadooken-provider") as "gemini" | "vertex") || "gemini";
    }
    return "gemini";
  });
  const [availableProviders, setAvailableProviders] = useState<{ gemini: boolean; vertex: boolean } | null>(null);
  const checkProviders = useAction(api.images.getAvailableProviders);
  const showProviderToggle = !!(availableProviders?.gemini && availableProviders?.vertex);

  useEffect(() => {
    checkProviders().then(setAvailableProviders).catch(() => { });
  }, []);

  useEffect(() => {
    localStorage.setItem("hadooken-provider", provider);
  }, [provider]);

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

  // Cost aggregates (from all generations)
  const { totalCost, monthCost, totalImages, totalRuns } = useMemo(() => {
    if (!generations) return { totalCost: 0, monthCost: 0, totalImages: 0, totalRuns: 0 };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let total = 0;
    let month = 0;
    let images = 0;
    for (const gen of generations) {
      images += gen.imageStorageIds.length;
      if (gen.status !== "complete") continue;
      const cost = calculateGenerationCost(gen.model, gen.promptTokens, gen.imageStorageIds.length);
      total += cost;
      if (gen.createdAt >= monthStart) month += cost;
    }
    return { totalCost: total, monthCost: month, totalImages: images, totalRuns: generations.length };
  }, [generations]);

  const generate = useAction(api.images.generate);
  const [rerunning, setRerunning] = useState(false);

  const handleRerun = useCallback(async () => {
    if (!selectedGeneration || rerunning) return;
    const gen = selectedGeneration;
    setRerunning(true);
    try {
      await generate({
        prompt: gen.originalPrompt || gen.prompt,
        originalPrompt: gen.originalPrompt,
        stylePreset: gen.stylePreset,
        styleSuffix: gen.styleSuffix,
        aspectRatio: gen.aspectRatio,
        numberOfImages: gen.numberOfImages,
        referenceImageStorageIds: gen.referenceImageStorageIds?.length ? gen.referenceImageStorageIds : undefined,
        keepReferenceIds: gen.referenceImageStorageIds?.length ? gen.referenceImageStorageIds : undefined,
        enhancePrompt: gen.wasEnhanced || false,
        thinkingLevel: gen.thinkingLevel === "low" || gen.thinkingLevel === "high" ? gen.thinkingLevel : undefined,
        model: gen.model,
      });
    } catch {
      // errors will show in the new generation's status
    } finally {
      setRerunning(false);
    }
  }, [selectedGeneration, rerunning, generate]);

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
    <div className="flex h-screen bg-zinc-200 dark:bg-zinc-950 overflow-hidden p-3 gap-3">
      {/* Combined Sidebar */}
      <div className="flex shrink-0 rounded-2xl overflow-hidden bg-white/40 dark:bg-card/75">
        {/* Sidebar 1: Logo + Create */}
        <div className="w-[420px] shrink-0 flex flex-col bg-card rounded-r-xl">
          {/* Logo */}
          <div className="flex items-center justify-between px-7 h-24 border-b border-border/50">
            <svg
              height="28"
              viewBox="0 0 2910 499"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M661.614 211.117C675.19 234.631 675.19 263.602 661.614 287.117L561.665 460.234C548.089 483.748 522.999 498.234 495.847 498.234L175.949 498.234C148.797 498.234 123.707 483.748 110.131 460.234L10.1821 287.117C-3.39402 263.602 -3.39402 234.631 10.1821 211.117L110.131 38C123.707 14.4855 148.797 -1.18686e-06 175.949 0L495.847 8.73782e-06C522.999 9.92468e-06 548.089 14.4855 561.665 38L661.614 211.117Z" fill="currentColor" />
              <path d="M417.034 134.498C384.51 185.252 328.378 215.949 268.097 215.949H165.835C153.623 215.949 143.724 225.849 143.724 238.061V260.173C143.724 272.385 153.623 282.284 165.835 282.284H268.098C328.379 282.284 384.511 312.982 417.035 363.737L460.291 431.238C466.879 441.52 480.556 444.513 490.838 437.924L509.455 425.994C519.737 419.405 522.731 405.729 516.142 395.447L483.532 344.559C446.256 286.39 446.256 211.844 483.532 153.675L516.142 102.787C522.731 92.5049 519.737 78.8285 509.455 72.2396L490.838 60.309C480.556 53.7201 466.879 56.7139 460.29 66.9958L417.034 134.498Z" fill="var(--card)" />
              <path d="M1106.2 218.805L1090.15 202.406H952.548V360.69H904.777V111.144H952.548V154.279H1109.76L1154.32 198.841V360.69H1106.2V218.805Z" fill="currentColor" />
              <path d="M1200.57 154.279H1405.56L1450.12 198.841V316.128L1405.56 360.69H1245.13L1200.57 316.128V255.168H1248.34V296.521L1264.74 312.92H1385.59L1401.99 296.521V218.805L1385.59 202.406H1200.57V154.279Z" fill="currentColor" />
              <path d="M1695.83 154.279V111.144H1743.96V316.128L1699.39 360.69H1538.97L1494.41 316.128V198.841L1538.97 154.279H1695.83ZM1695.83 296.521V202.406H1558.58L1542.18 218.805V296.521L1558.58 312.92H1679.43L1695.83 296.521Z" fill="currentColor" />
              <path d="M1833.1 154.279H1998.16L2040.58 196.702V318.624L1998.16 360.69H1833.1L1791.03 318.624V196.702L1833.1 154.279ZM1992.45 298.66V216.31L1978.55 202.406H1853.06L1838.8 216.31V298.66L1853.06 312.92H1978.55L1992.45 298.66Z" fill="currentColor" />
              <path d="M2324.27 360.69H2293.61L2122.49 255.524V360.69H2074.72V111.144H2122.49V199.198L2188.44 239.838L2266.16 154.279H2324.27V161.766L2229.8 265.506L2324.27 323.258V360.69Z" fill="currentColor" />
              <path d="M2609.28 360.69H2404.29L2359.73 316.128V198.841L2404.29 154.279H2609.28V245.899L2542.25 312.92H2609.28V360.69ZM2407.5 218.805V296.521L2423.9 312.92H2474.52L2561.15 225.935V202.406H2423.9L2407.5 218.805Z" fill="currentColor" />
              <path d="M2861.36 360.69V218.805L2844.96 202.406H2707.71V360.69H2659.94V154.279H2696.3L2725.18 183.156H2757.98L2786.5 154.279H2864.93L2909.49 198.841V360.69H2861.36Z" fill="currentColor" />
            </svg>
            <div className="flex items-center gap-1.5">
              <SettingsDialog
                provider={provider}
                onProviderChange={setProvider}
                showProviderToggle={showProviderToggle}
              />
              <ThemeToggle />
            </div>
          </div>

          {/* Create Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <PromptForm onGenerated={handleGenerated} provider={provider} showProviderToggle={showProviderToggle} />
          </div>
        </div>

        {/* Sidebar 2: History */}
        <div className="w-96 shrink-0 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-7 h-24 shrink-0 border-b border-border/50">
            <h2 className="text-sm font-semibold">History</h2>
            {generations && (
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {totalImages} images &middot; {totalRuns} runs
                </span>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  ${monthCost.toFixed(2)} this month &middot; ${totalCost.toFixed(2)} total
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <GenerationHistory
              selectedId={selectedId}
              onSelect={handleSelectGeneration}
            />
          </div>
        </div>
      </div>

      {/* Main: Result / Gallery */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Gallery Header */}
        <div className="px-7 h-24 border-b border-border/50 shrink-0 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold truncate">
            {selectedGeneration ? selectedGeneration.prompt : "Gallery"}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {selectedGeneration?.model && (
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {selectedGeneration.model}
              </span>
            )}
            {selectedGeneration?.provider === "vertex" && (
              <span className="text-[11px] text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/20">
                Vertex AI
              </span>
            )}
            {selectedGeneration && selectedGeneration.status === "complete" && (
              <button
                onClick={handleRerun}
                disabled={rerunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
              >
                {rerunning ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                )}
                {rerunning ? "Rerunning..." : "Rerun"}
              </button>
            )}
          </div>
        </div>

        {/* Gallery Content */}
        <div className="flex-1 overflow-auto p-8">
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
              status={selectedGeneration.status}
              error={selectedGeneration.error}
              aspectRatio={selectedGeneration.aspectRatio}
              promptTokens={selectedGeneration.promptTokens}
              thinkingLevel={selectedGeneration.thinkingLevel}
              referenceImageStorageIds={selectedGeneration.referenceImageStorageIds}
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
