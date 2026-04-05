"use client";

import { useState, useRef, useEffect } from "react";
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

const MODELS = [
  { value: "imagen-4", label: "Imagen 4", description: "Best for text-to-image" },
  { value: "nano-banana-pro", label: "Nano Banana Pro", description: "Best quality with references" },
  { value: "nano-banana-2", label: "Nano Banana 2", description: "Fast, high-volume" },
];

const ASPECT_RATIOS = [
  { value: "auto", label: "Auto" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "4:3", label: "4:3 (Standard)" },
  { value: "3:4", label: "3:4 (Tall)" },
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
  const [inFlightCount, setInFlightCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [savedRefStorageId, setSavedRefStorageId] = useState<Id<"_storage"> | null>(null);
  const [savedRefName, setSavedRefName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generate = useAction(api.images.generate);
  const generateUploadUrl = useMutation(api.generations.generateUploadUrl);
  const saveReference = useMutation(api.referenceImages.save);

  const hasReference = referenceFile !== null || savedRefStorageId !== null;
  const currentStyle = STYLE_PRESETS.find((s) => s.value === stylePreset);
  const currentModel = MODELS.find((m) => m.value === model);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceFromFile(file);
  };

  const setReferenceFromFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) { setError("Image must be under 20MB."); return; }
    setSavedRefStorageId(null);
    setSavedRefName(null);
    setReferenceFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setReferencePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Listen for clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) setReferenceFromFile(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const clearReference = () => {
    setReferenceFile(null);
    setReferencePreview(null);
    setSavedRefStorageId(null);
    setSavedRefName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectSavedRef = (storageId: Id<"_storage">, name: string) => {
    if (savedRefStorageId === storageId) { clearReference(); } else {
      setReferenceFile(null); setReferencePreview(null);
      setSavedRefStorageId(storageId); setSavedRefName(name);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveReference = async () => {
    if (!referenceFile) return;
    const uploadUrl = await generateUploadUrl();
    const uploadResult = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": referenceFile.type }, body: referenceFile });
    const { storageId } = await uploadResult.json();
    const name = referenceFile.name.replace(/\.[^.]+$/, "");
    await saveReference({ storageId, name });
    setSavedRefStorageId(storageId); setSavedRefName(name);
    setReferenceFile(null); setReferencePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setInFlightCount((c) => c + 1);
    setError(null);

    try {
      let referenceImageStorageId: Id<"_storage"> | undefined;
      let keepReference = false;

      if (savedRefStorageId) {
        referenceImageStorageId = savedRefStorageId;
        keepReference = true;
      } else if (referenceFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": referenceFile.type }, body: referenceFile });
        const { storageId } = await uploadResult.json();
        referenceImageStorageId = storageId;
      }

      const generationId = await generate({
        prompt: prompt.trim(),
        originalPrompt: prompt.trim(),
        stylePreset: stylePreset !== "none" ? currentStyle?.label : undefined,
        styleSuffix: stylePreset !== "none" ? currentStyle?.suffix : undefined,
        aspectRatio,
        numberOfImages,
        referenceImageStorageId,
        keepReference,
        enhancePrompt,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt">Prompt</Label>
          <SavedPrompts onSelect={(text) => setPrompt(text)} />
        </div>
        <Textarea
          id="prompt"
          placeholder="Describe the image you want to generate..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="resize-none"

        />
      </div>

      {/* Model */}
      <div>
        <Label className="mb-2 block">Model</Label>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
            <span>{currentModel?.label}</span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={model} onValueChange={(v) => v && setModel(v)}>
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

      {/* Reference Image */}
      <div className="space-y-3">
        <Label>Reference Image (optional)</Label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        <div className="flex gap-3">
          {referencePreview ? (
            <div className="relative group flex-1 h-24">
              <img src={referencePreview} alt="Reference" className="w-full h-full object-cover rounded-lg border border-border" />
              <div className="absolute top-2 right-2 flex gap-1">
                <button type="button" onClick={handleSaveReference} title="Save to library" className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                </button>
                <button type="button" onClick={clearReference} className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
            </div>
          ) : savedRefStorageId ? (
            <div className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 h-24">
              <div className="h-10 w-10 rounded bg-muted shrink-0 overflow-hidden">
                <SavedRefPreview storageId={savedRefStorageId} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{savedRefName}</p>
                <p className="text-[11px] text-muted-foreground">Saved reference</p>
              </div>
              <button type="button" onClick={clearReference} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 h-24 rounded-lg border border-dashed border-border hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              <span className="text-xs">Upload or paste (⌘V)</span>
            </button>
          )}
          <SavedReferences onSelect={handleSelectSavedRef} selectedStorageId={savedRefStorageId} variant="box" />
        </div>
      </div>

      {/* Style Preset */}
      <div className="space-y-2">
        <Label>Style</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((style) => (
            <button key={style.value} type="button" onClick={() => setStylePreset(style.value)}              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${stylePreset === style.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Enhance Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">AI Enhance</Label>
          <p className="text-xs text-muted-foreground">Rewrite prompt with Gemini for better results</p>
        </div>
        <button type="button" role="switch" aria-checked={enhancePrompt} onClick={() => setEnhancePrompt(!enhancePrompt)}          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enhancePrompt ? "bg-primary" : "bg-muted"}`}>
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${enhancePrompt ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Aspect Ratio + Image Count */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Aspect Ratio</Label>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
              <span>{ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={aspectRatio} onValueChange={(v) => v && setAspectRatio(v)}>
                {ASPECT_RATIOS.map((r) => (
                  <DropdownMenuRadioItem key={r.value} value={r.value}>{r.label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <Label className="mb-2 block">Images</Label>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-between w-full rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
              <span>{numberOfImages} {numberOfImages === 1 ? "image" : "images"}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={String(numberOfImages)} onValueChange={(v) => v && setNumberOfImages(parseInt(v))}>
                {IMAGE_COUNTS.map((n) => (
                  <DropdownMenuRadioItem key={n} value={String(n)}>{n} {n === 1 ? "image" : "images"}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={!prompt.trim() || inFlightCount >= 3}>
        {inFlightCount >= 3 ? "Limit reached (3/3)" : hasReference ? "Edit with Reference" : "Generate"}
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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-[11px] text-muted-foreground">
          {currentModel?.label ?? model}
        </div>
        {stylePreset !== "none" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-[11px] text-muted-foreground">
            + {currentStyle?.label}
          </div>
        )}
        {enhancePrompt && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-[11px] text-muted-foreground">
            + AI Enhance
          </div>
        )}
      </div>
    </form>
  );
}

function SavedRefPreview({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useQuery(api.referenceImages.getUrl, { storageId });
  if (!url) return <div className="w-full h-full bg-muted animate-pulse" />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}
