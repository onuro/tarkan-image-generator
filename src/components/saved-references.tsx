"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";

interface SavedReferencesProps {
  onSelect: (storageId: Id<"_storage">, name: string) => void;
  selectedStorageId: Id<"_storage"> | null;
  variant?: "link" | "box";
}

export function SavedReferences({ onSelect, selectedStorageId, variant = "link" }: SavedReferencesProps) {
  const [open, setOpen] = useState(false);
  const references = useQuery(api.referenceImages.list);
  const removeRef = useMutation(api.referenceImages.remove);

  const count = references?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "box"
          ? "size-24 rounded-lg border border-dashed border-border hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground cursor-pointer"
          : "text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
        }
      >
        {variant === "box" ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z" /><path d="M2 8v11a2 2 0 0 0 2 2h14" /></svg>
            <span className="text-xs">{count > 0 ? `Saved refs (${count})` : "Saved refs"}</span>
          </>
        ) : (
          count > 0 ? `Browse saved references (${count})` : "No saved references"
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved References</DialogTitle>
          </DialogHeader>

          {!references ? (
            <div className="grid grid-cols-4 gap-4 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : references.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No saved references yet.</p>
              <p className="text-xs mt-1">Upload a reference image and click the save icon to add one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 py-4">
              {references.map((ref) => (
                <RefThumbnail
                  key={ref._id}
                  refImage={ref}
                  isSelected={selectedStorageId === ref.storageId}
                  onSelect={() => {
                    onSelect(ref.storageId, ref.name);
                    setOpen(false);
                  }}
                  onRemove={() => removeRef({ id: ref._id })}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefThumbnail({
  refImage,
  isSelected,
  onSelect,
  onRemove,
}: {
  refImage: {
    _id: Id<"referenceImages">;
    storageId: Id<"_storage">;
    name: string;
  };
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const url = useQuery(api.referenceImages.getUrl, {
    storageId: refImage.storageId,
  });

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
          isSelected
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-muted-foreground/50"
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={refImage.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted animate-pulse" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
      <p className="text-[11px] text-muted-foreground truncate mt-1.5 text-center">
        {refImage.name}
      </p>
    </div>
  );
}
