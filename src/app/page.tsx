"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { calculateGenerationCost } from "@/lib/pricing";
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
    <div className="flex h-screen bg-background overflow-hidden p-3 gap-3">
      {/* Combined Sidebar */}
      <div className="flex shrink-0 rounded-2xl overflow-hidden bg-card/75">
        {/* Sidebar 1: Logo + Create */}
        <div className="w-[420px] shrink-0 flex flex-col bg-card rounded-r-xl">
          {/* Logo */}
          <div className="flex items-center gap-4 px-7 h-18 border-b border-border/50">
            <div className="h-10 w-10 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 599 548"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M414.363 200.653C420.787 197.721 427.925 197.892 435.514 201.504L435.511 201.507C440.756 203.804 444.381 207.351 446.502 211.798C448.573 216.142 448.993 220.877 448.76 225.243C448.527 229.622 447.611 234.061 446.642 238.044C445.584 242.385 444.656 245.503 443.905 248.851L443.855 249.066L443.791 249.279C439.714 262.703 440.699 271.322 443.739 277.054C446.801 282.828 452.622 286.954 460.984 289.919C469.359 292.888 479.535 294.427 490.243 295.515C499.29 296.434 509.139 297.056 517.642 298.039L521.198 298.482L521.448 298.517L521.696 298.572C522.293 298.706 523.705 298.834 526.205 298.852C528.569 298.869 531.476 298.79 534.82 298.674C541.423 298.446 549.609 298.076 557.6 298.129C565.533 298.182 573.746 298.648 580.418 300.236C583.756 301.031 587.041 302.182 589.791 303.938C592.418 305.616 594.802 308.018 595.996 311.355L596.217 312.037L596.22 312.046C599.893 324.466 598.326 334.364 591.157 341.016C584.659 347.045 574.838 349.034 565.562 349.687C556.034 350.357 545.476 349.688 536.391 349.151C526.859 348.587 519.503 348.231 515.115 349.06L514.789 349.121L514.456 349.148C493.454 350.742 471.554 352.033 450.597 356.244C429.705 360.443 410.247 367.46 394.186 380.193L388.43 384.757L388.386 384.673C371.67 398.767 357.592 419.18 344.838 441.511C337.794 453.844 331.24 466.598 324.894 479.012C318.574 491.375 312.436 503.452 306.311 514.205L306.305 514.214C305.366 515.856 304.256 518.14 302.904 520.952C301.592 523.68 300.095 526.81 298.491 529.853C296.892 532.887 295.101 536 293.146 538.701C291.251 541.32 288.881 544.009 285.991 545.722L285.084 546.259L284.05 546.454C272.284 548.661 260.902 545.287 254.188 537.495C247.221 529.407 246.385 517.872 253.31 506.511C281.836 450.202 313.096 387.708 341.232 331.078C349.931 313.086 371.923 270.026 380.995 251.94L381.007 251.914L381.021 251.89C383.928 246.23 386.65 239.879 389.727 233.191C392.725 226.673 396.014 219.946 399.826 214.267C403.597 208.648 408.287 203.427 414.363 200.653ZM279.116 541.074C278.536 541.113 277.962 541.142 277.393 541.15H277.463C278.009 541.141 278.56 541.112 279.116 541.074ZM281.068 540.884C280.76 540.924 280.453 540.958 280.147 540.989C280.761 540.927 281.381 540.849 282.004 540.75L281.068 540.884ZM530.052 342.823C536.501 343.133 543.765 343.684 550.993 343.904C542.561 343.648 534.08 342.941 526.901 342.692L530.052 342.823ZM561.698 343.913C560.535 343.956 559.359 343.984 558.174 343.995C559.951 343.978 561.708 343.928 563.432 343.837L561.698 343.913ZM569.937 343.252C568.92 343.386 567.884 343.504 566.83 343.598L568.488 343.432C568.976 343.378 569.458 343.315 569.937 343.252ZM521.099 342.61C518.396 342.648 516.002 342.821 514.022 343.193C516.664 342.696 520.043 342.56 523.908 342.616L521.099 342.61ZM589.065 334.435C588.849 334.728 588.627 335.016 588.392 335.292L588.785 334.811C588.881 334.688 588.972 334.561 589.065 334.435ZM589.977 333.036C589.828 333.295 589.676 333.55 589.514 333.797L589.846 333.266C589.891 333.191 589.933 333.113 589.977 333.036ZM521.483 304.582C521.579 304.594 521.678 304.597 521.778 304.608C521.465 304.573 521.174 304.543 520.906 304.497L521.483 304.582ZM411.93 209.266C411.808 209.369 411.689 209.475 411.568 209.581C411.946 209.249 412.327 208.93 412.714 208.627L411.93 209.266Z" fill="currentColor" />
                <path fillRule="evenodd" clipRule="evenodd" d="M373.17 0.00397605C380.652 -0.134352 387.235 3.34878 391.805 8.56097C400.824 18.8488 402.483 36.2526 390.027 50.1889C338.355 152.466 251.399 326.162 199.275 430.142C195.95 438.198 190.444 443.522 183.913 446.049C177.412 448.564 170.407 448.114 164.45 445.595C158.497 443.077 153.316 438.378 150.583 432.042C147.857 425.722 147.771 418.23 151.116 410.475C154.525 398.587 156.837 385.773 155.153 375.521C154.321 370.464 152.565 366.339 149.77 363.219C147.017 360.147 142.871 357.617 136.462 356.364L136.243 356.323L136.031 356.265C119.627 351.77 99.6713 350.037 79.0928 349.328C68.8412 348.975 58.5331 348.879 48.5196 348.801C38.5372 348.723 28.8134 348.663 19.8641 348.384L19.5989 348.378L19.3337 348.346C6.41668 346.786 0.620235 334.688 0.0483959 324.747C-0.517854 314.896 3.82078 302.153 16.4513 299.537L17.6171 305.179L17.6316 299.414H17.6608C107.221 299.788 157.643 294.866 195.21 270.943C232.783 247.014 258.482 203.451 296.163 122.687L296.232 122.547C311.635 91.6524 336.58 43.7608 350.763 12.8074L351.118 12.0292L351.681 11.3822C358.143 3.93386 365.632 0.14376 373.17 0.00397605ZM387.821 43.4331C387.003 44.576 386.08 45.7031 385.046 46.8081C385.735 46.0714 386.378 45.3243 386.97 44.5697C387.562 43.8153 388.106 43.0529 388.605 42.2848L387.821 43.4331ZM15.5361 341.098C15.9896 341.32 16.4588 341.519 16.9438 341.692C17.4292 341.866 17.9308 342.013 18.4477 342.135C18.965 342.257 19.4991 342.352 20.0478 342.418C18.4028 342.219 16.8981 341.765 15.5361 341.098ZM391.901 35.2725C391.782 35.6637 391.654 36.0556 391.514 36.447C391.794 35.6637 392.032 34.8799 392.231 34.0979L391.901 35.2725ZM392.709 31.7576C392.648 32.1462 392.579 32.5359 392.499 32.9263C392.658 32.1455 392.78 31.3677 392.863 30.5947L392.709 31.7576ZM392.44 22.7575C392.506 23.0546 392.564 23.354 392.618 23.6552C392.499 22.9933 392.356 22.3405 392.184 21.6996L392.44 22.7575ZM386.629 11.7494C387.097 12.2349 387.545 12.7459 387.97 13.2796L387.317 12.4956C387.093 12.2405 386.863 11.9922 386.629 11.7494Z" fill="currentColor" />
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-sm font-semibold leading-none">Tarkan</h1>
              <p className="text-[11px] text-muted-foreground leading-none">AI Image Generator</p>
            </div>
          </div>

          {/* Create Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <PromptForm onGenerated={handleGenerated} />
          </div>
        </div>

        {/* Sidebar 2: History */}
        <div className="w-96 shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-7 h-18 shrink-0 border-b border-border/50">
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
        <div className="px-7 h-18 border-b border-border/50 shrink-0 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold truncate">
            {selectedGeneration ? selectedGeneration.prompt : "Gallery"}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {selectedGeneration?.model && (
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {selectedGeneration.model}
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
