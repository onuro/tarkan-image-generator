"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";

interface SavedPromptsProps {
  onSelect: (text: string) => void;
}

export function SavedPrompts({ onSelect }: SavedPromptsProps) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const prompts = useQuery(api.savedPrompts.list);
  const removePrompt = useMutation(api.savedPrompts.remove);
  const savePrompt = useMutation(api.savedPrompts.save);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");

  const count = prompts?.length ?? 0;

  const handleSave = async () => {
    if (!newText.trim() || !newName.trim()) return;
    await savePrompt({ text: newText.trim(), name: newName.trim() });
    setNewName("");
    setNewText("");
    setSaveOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
        >
          {count > 0 ? `Saved (${count})` : "Save prompts"}
        </button>
      </div>

      {/* Browse saved prompts dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Saved Prompts</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setOpen(false); setSaveOpen(true); }}
              >
                Save New
              </Button>
            </div>
          </DialogHeader>

          {!prompts ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : prompts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No saved prompts yet.</p>
              <p className="text-xs mt-1">Click &quot;Save New&quot; to save a prompt for reuse.</p>
            </div>
          ) : (
            <div className="space-y-2 py-4 max-h-96 overflow-auto">
              {prompts.map((p) => (
                <div
                  key={p._id}
                  className="group flex items-start gap-3 rounded-lg p-3 hover:bg-accent transition-colors cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => { onSelect(p.text); setOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(p.text);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePrompt({ id: p._id }); }}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-all shrink-0 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save new prompt dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 3D Logo Render"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt</label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter your reusable prompt..."
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!newName.trim() || !newText.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
