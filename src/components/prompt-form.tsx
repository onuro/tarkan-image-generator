"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { SavedReferences } from "./saved-references";
import { SavedPrompts } from "./saved-prompts";

const MAX_REFS = 14;

const MODELS = [
  { value: "imagen-4", label: "Imagen 4", description: "Best for text-to-image" },
  { value: "nano-banana-pro", label: "Nano Banana Pro", description: "Best quality with references" },
  { value: "nano-banana-2", label: "Nano Banana 2", description: "Fast, high-volume" },
];

const ASPECT_RATIOS = [
  { value: "auto", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
];

const IMAGE_COUNTS = [1, 2, 3, 4];

const STYLE_PRESETS = [
  { value: "none", label: "None", suffix: "" },
  { value: "photorealistic", label: "Photorealistic", suffix: "Shot on a Canon EOS R5 with an 85mm f/1.4 lens, natural skin texture with subsurface scattering, shallow depth of field with creamy bokeh, soft diffused golden hour lighting, film grain on Kodak Portra 400 stock, hyperrealistic fine detail, 8K resolution, taken by a professional photographer" },
  { value: "3d-render", label: "3D Render", suffix: "Octane render with global illumination and ray-traced shadows, PBR materials with subsurface scattering, HDRI studio lighting with soft ambient occlusion, noise-free final render, volumetric atmosphere, physically accurate reflections and caustics, 8K ultra-high resolution production CGI quality" },
  { value: "illustration", label: "Illustration", suffix: "Detailed digital illustration with clean precise linework and bold outlines, rich vibrant color palette with layered shading, dynamic composition with strong silhouette, professional concept art quality, painterly background with atmospheric depth, studio-quality character design, high detail throughout" },
  { value: "oil-painting", label: "Oil Painting", suffix: "Classical oil painting on linen canvas, visible impasto brushstrokes with palette knife texture, rich color saturation with deep warm undertones, chiaroscuro lighting with dramatic tonal contrast, glazed layers with luminous depth, in the tradition of the Dutch Masters, gallery-quality fine art" },
  { value: "watercolor", label: "Watercolor", suffix: "Traditional watercolor painting on cold-press textured paper, translucent washes with natural pigment bleeding and soft color diffusion, visible paper grain showing through, wet-on-wet blending with delicate dry brush details, loose expressive brushwork, gentle luminous highlights, fine art quality" },
  { value: "anime", label: "Anime", suffix: "High-quality anime key visual, crisp cel-shaded coloring with clean bold outlines, expressive detailed eyes with specular highlights, vibrant saturated color palette, dramatic rim lighting with soft atmospheric glow, detailed background art, light novel illustration quality, 4K anime wallpaper" },
  { value: "pixel-art", label: "Pixel Art", suffix: "16-bit pixel art in a classic SNES RPG style, clean aligned pixel grid with carefully placed individual pixels, limited harmonious color palette with deliberate dithering for shading, sharp edges with no anti-aliasing, nostalgic retro game aesthetic, sprite-quality craftsmanship" },
  { value: "cinematic", label: "Cinematic", suffix: "Shot on ARRI Alexa with anamorphic lens, cinematic 2.39:1 widescreen framing, dramatic volumetric god rays with atmospheric haze, shallow depth of field, color graded with teal-and-orange contrast, Kodak Vision3 500T film stock grain, moody chiaroscuro lighting, blockbuster movie still quality" },
  { value: "isometric", label: "Isometric", suffix: "Isometric illustration at a precise 30-degree angle, clean vector-style rendering with consistent geometric perspective, charming miniature detail that rewards close inspection, cohesive bright friendly color palette, crisp outlines with subtle flat shading, diorama-like depth, polished game art quality" },
  { value: "pencil-sketch", label: "Pencil Sketch", suffix: "Detailed graphite pencil drawing on heavy textured sketch paper, masterful cross-hatching and stippling for tonal depth, precise confident linework ranging from fine detail to bold expressive strokes, realistic proportions with strong value contrast, visible paper tooth, professional artist quality" },
];

interface PromptFormProps {
  onGenerated: (generationId: Id<"generations">) => void;
}

interface ReferenceItem {
  id: string;
  source: "file" | "saved";
  file?: File;
  storageId?: Id<"_storage">;
  previewUrl: string;
  name: string;
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PromptForm({ onGenerated }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("imagen-4");
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [stylePreset, setStylePreset] = useState("none");
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<"none" | "low" | "high">("none");
  const [inFlightCount, setInFlightCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [modelOpen, setModelOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [refPreviewIndex, setRefPreviewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @ mention autocomplete state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0); // cursor pos of the "@"
  const [mentionIndex, setMentionIndex] = useState(0); // highlighted item

  const generate = useAction(api.images.generate);
  const generateUploadUrl = useMutation(api.generations.generateUploadUrl);
  const saveReference = useMutation(api.referenceImages.save);
  const generations = useQuery(api.generations.list);

  const quotaExceeded = generations?.some(
    (g) => g.status === "failed" && g.error?.includes("Daily API quota exceeded")
  ) ?? false;

  const hasReference = references.length > 0;
  const currentStyle = STYLE_PRESETS.find((s) => s.value === stylePreset);
  const currentModel = MODELS.find((m) => m.value === model);

  const selectedSavedIds = new Set(
    references.filter((r) => r.source === "saved" && r.storageId).map((r) => r.storageId!.toString())
  );

  const addFileReference = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) { setError("Image must be under 20MB."); return; }
    if (references.length >= MAX_REFS) { setError(`Maximum ${MAX_REFS} reference images.`); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setReferences((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          source: "file",
          file,
          previewUrl,
          name: file.name.replace(/\.[^.]+$/, ""),
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const addSavedReference = (storageId: Id<"_storage">, name: string, url: string) => {
    if (references.length >= MAX_REFS) { setError(`Maximum ${MAX_REFS} reference images.`); return; }
    const alreadyAdded = references.some((r) => r.source === "saved" && r.storageId === storageId);
    if (alreadyAdded) {
      setReferences((prev) => prev.filter((r) => !(r.source === "saved" && r.storageId === storageId)));
      return;
    }
    setError(null);
    setReferences((prev) => [
      ...prev,
      { id: crypto.randomUUID(), source: "saved", storageId, previewUrl: url, name },
    ]);
  };

  const removeReference = (index: number) => {
    setReferences((prev) => prev.filter((_, i) => i !== index));
    if (refPreviewIndex === index) setRefPreviewIndex(null);
    else if (refPreviewIndex !== null && refPreviewIndex > index) setRefPreviewIndex(refPreviewIndex - 1);
  };

  const saveToLibrary = async (index: number) => {
    const ref = references[index];
    if (!ref || ref.source !== "file" || !ref.file) return;
    const uploadUrl = await generateUploadUrl();
    const uploadResult = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": ref.file.type }, body: ref.file });
    const { storageId } = await uploadResult.json();
    const name = ref.name;
    await saveReference({ storageId, name });
    setReferences((prev) =>
      prev.map((r, i) => i === index ? { ...r, source: "saved" as const, storageId, file: undefined } : r)
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      addFileReference(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // @ mention autocomplete
  const mentionItems = references.map((ref, i) => ({
    label: `@img${i + 1}`,
    name: ref.name,
    previewUrl: ref.previewUrl,
  }));

  const filteredMentions = mentionOpen
    ? mentionItems.filter((item) => item.label.startsWith(`@${mentionQuery}`))
    : [];

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setPrompt(value);

    // Check if we're in an @mention context
    const textBefore = value.slice(0, cursor);
    const atMatch = textBefore.match(/@([\w]*)$/);
    if (atMatch && references.length > 0) {
      setMentionOpen(true);
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (label: string) => {
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(mentionStart + mentionQuery.length + 1); // +1 for the "@"
    const newPrompt = `${before}${label} ${after}`;
    setPrompt(newPrompt);
    setMentionOpen(false);
    // Restore focus and cursor position after insert
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + label.length + 1;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    });
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen || filteredMentions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredMentions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex].label);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionOpen(false);
    }
  };

  // Close ref preview on Escape
  useEffect(() => {
    if (refPreviewIndex === null) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRefPreviewIndex(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [refPreviewIndex]);

  // Listen for clipboard paste — append to references
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) addFileReference(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [references.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setInFlightCount((c) => c + 1);
    setError(null);

    try {
      const uploadedStorageIds: Id<"_storage">[] = [];
      const keepIds: Id<"_storage">[] = [];

      for (const ref of references) {
        if (ref.source === "saved" && ref.storageId) {
          uploadedStorageIds.push(ref.storageId);
          keepIds.push(ref.storageId);
        } else if (ref.source === "file" && ref.file) {
          const uploadUrl = await generateUploadUrl();
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": ref.file.type },
            body: ref.file,
          });
          const { storageId } = await res.json();
          uploadedStorageIds.push(storageId);
        }
      }

      const generationId = await generate({
        prompt: prompt.trim(),
        originalPrompt: prompt.trim(),
        stylePreset: stylePreset !== "none" ? currentStyle?.label : undefined,
        styleSuffix: stylePreset !== "none" ? currentStyle?.suffix : undefined,
        aspectRatio,
        numberOfImages,
        referenceImageStorageIds: uploadedStorageIds.length > 0 ? uploadedStorageIds : undefined,
        keepReferenceIds: keepIds.length > 0 ? keepIds : undefined,
        enhancePrompt,
        thinkingLevel: thinkingLevel !== "none" ? thinkingLevel : undefined,
        model,
      });
      onGenerated(generationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate images");
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-9">
      {/* Model */}
      <div>
        <Label className="mb-3 block">Model</Label>
        <DropdownMenu open={modelOpen} onOpenChange={setModelOpen}>
          <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg bg-zinc-800/40 px-4 py-2.5 text-sm hover:bg-zinc-800/60 transition-colors">
            <span>{currentModel?.label}</span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={model} onValueChange={(v) => { if (v) { setModel(v); setModelOpen(false); } }}>
              {MODELS.map((m) => (
                <DropdownMenuRadioItem key={m.value} value={m.value}>
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.description}</p>
                  </div>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt">Prompt</Label>
          <SavedPrompts onSelect={(text) => setPrompt(text)} />
        </div>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            id="prompt"
            placeholder="Describe the image you want to generate... Use @img1, @img2 etc. to reference images"
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleTextareaKeyDown}
            onBlur={() => { setTimeout(() => setMentionOpen(false), 150); }}
            rows={4}
            className="resize-none border-transparent bg-zinc-800/40"
          />
          {mentionOpen && filteredMentions.length > 0 && (
            <div className="absolute z-50 left-2 bottom-full mb-1 w-56 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {filteredMentions.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(item.label); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors cursor-pointer ${i === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                >
                  <img src={item.previewUrl} alt="" className="size-8 rounded object-cover shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-medium">{item.label}</span>
                    <p className="text-[11px] text-muted-foreground truncate">{item.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reference Images */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>References (optional)</Label>
          {references.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{references.length}/{MAX_REFS}</span>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

        <div className="flex gap-3 overflow-x-auto pb-1">
          {references.map((ref, index) => (
            <div key={ref.id} className="relative group shrink-0">
              <button
                type="button"
                onClick={() => setRefPreviewIndex(index)}
                className="size-20 rounded-lg overflow-hidden border border-border hover:border-muted-foreground/50 transition-all cursor-pointer"
              >
                <img src={ref.previewUrl} alt={ref.name} className="w-full h-full object-cover" />
              </button>
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {ref.source === "file" && (
                  <button type="button" onClick={() => saveToLibrary(index)} title="Save to library" className="h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors cursor-pointer">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                  </button>
                )}
                <button type="button" onClick={() => removeReference(index)} className="h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors cursor-pointer">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1 font-mono">@img{index + 1}</p>
            </div>
          ))}

          {references.length < MAX_REFS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="size-20 shrink-0 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground/70 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              <span className="text-[10px]">Add</span>
            </button>
          )}

          <SavedReferences
            onSelect={addSavedReference}
            selectedStorageIds={selectedSavedIds}
            variant="box"
          />
        </div>

        {references.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Upload, paste (Cmd+V), or pick from saved refs</p>
        )}

        {hasReference && model === "imagen-4" && (
          <p className="text-[11px] text-amber-400">Imagen 4 doesn't support references. Will use Nano Banana Pro instead.</p>
        )}
      </div>

      {/* Style Preset */}
      <div className="space-y-3">
        <Label>Style</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((style) => (
            <button key={style.value} type="button" onClick={() => setStylePreset(style.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${stylePreset === style.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Enhance Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">AI Enhance</Label>
          <p className="text-xs text-muted-foreground mt-1.5">Rewrite prompt with Gemini for better results</p>
        </div>
        <button type="button" role="switch" aria-checked={enhancePrompt} onClick={() => setEnhancePrompt(!enhancePrompt)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enhancePrompt ? "bg-zinc-400" : "bg-zinc-700"}`}>
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${enhancePrompt ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Aspect Ratio + Image Count + Thinking */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="mb-3 block">Aspect Ratio</Label>
          <DropdownMenu open={aspectOpen} onOpenChange={setAspectOpen}>
            <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg bg-zinc-800/40 px-4 py-2.5 text-sm hover:bg-zinc-800/60 transition-colors">
              <span>{ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={aspectRatio} onValueChange={(v) => { if (v) { setAspectRatio(v); setAspectOpen(false); } }}>
                {ASPECT_RATIOS.map((r) => (
                  <DropdownMenuRadioItem key={r.value} value={r.value}>{r.label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <Label className="mb-3 block">Images</Label>
          <DropdownMenu open={countOpen} onOpenChange={setCountOpen}>
            <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg bg-zinc-800/40 px-4 py-2.5 text-sm hover:bg-zinc-800/60 transition-colors">
              <span>{numberOfImages} {numberOfImages === 1 ? "image" : "images"}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={String(numberOfImages)} onValueChange={(v) => { if (v) { setNumberOfImages(parseInt(v)); setCountOpen(false); } }}>
                {IMAGE_COUNTS.map((n) => (
                  <DropdownMenuRadioItem key={n} value={String(n)}>{n} {n === 1 ? "image" : "images"}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <Label className="mb-3 block">Thinking</Label>
          <DropdownMenu open={thinkingOpen} onOpenChange={setThinkingOpen}>
            <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg bg-zinc-800/40 px-4 py-2.5 text-sm hover:bg-zinc-800/60 transition-colors">
              <span>{thinkingLevel === "none" ? "Off" : thinkingLevel === "low" ? "Low" : "High"}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={thinkingLevel} onValueChange={(v) => { if (v) { setThinkingLevel(v as "none" | "low" | "high"); setThinkingOpen(false); } }}>
                <DropdownMenuRadioItem value="none">Off</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {quotaExceeded && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-destructive">Daily limit reached</p>
            <p className="text-xs text-destructive/70 mt-0.5">API quota exceeded (250 requests). Try again tomorrow.</p>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full h-10 text-base rounded-full" disabled={!prompt.trim() || inFlightCount >= 3 || quotaExceeded}>
        {quotaExceeded ? "Daily limit reached" : inFlightCount >= 3 ? "Limit reached (3/3)" : hasReference ? "Edit with Reference" : "Generate"}
      </Button>

      {inFlightCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {inFlightCount} generation{inFlightCount > 1 ? "s" : ""} in progress...
        </div>
      )}

      {/* Model indicator */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
          {currentModel?.label ?? model}
        </div>
        {stylePreset !== "none" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
            + {currentStyle?.label}
          </div>
        )}
        {enhancePrompt && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
            + AI Enhance
          </div>
        )}
        {hasReference && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
            + {references.length} ref{references.length > 1 ? "s" : ""}
          </div>
        )}
        {thinkingLevel !== "none" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
            + Thinking ({thinkingLevel})
          </div>
        )}
      </div>

      {/* Reference Image Preview Modal */}
      {refPreviewIndex !== null && references[refPreviewIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRefPreviewIndex(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-3xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setRefPreviewIndex(null)}
              className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
            {references.length > 1 && (
              <>
                {refPreviewIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setRefPreviewIndex(refPreviewIndex - 1)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                )}
                {refPreviewIndex < references.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setRefPreviewIndex(refPreviewIndex + 1)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                )}
              </>
            )}
            <div className="text-center mb-2">
              <span className="text-sm text-white/70 font-mono">@img{refPreviewIndex + 1}</span>
              <span className="text-sm text-white/50 ml-2">{references[refPreviewIndex].name}</span>
            </div>
            <img
              src={references[refPreviewIndex].previewUrl}
              alt={`Reference @img${refPreviewIndex + 1}`}
              className="max-w-full max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </form>
  );
}
