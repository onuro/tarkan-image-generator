"use client";

import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SettingsDialogProps {
  provider: "gemini" | "vertex";
  onProviderChange: (provider: "gemini" | "vertex") => void;
  showProviderToggle: boolean;
}

export function SettingsDialog({
  provider,
  onProviderChange,
  showProviderToggle,
}: SettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger
        className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {showProviderToggle ? (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">API Provider</Label>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {provider === "vertex"
                    ? "Using Vertex AI (GCP)"
                    : "Using Gemini API (AI Studio)"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={provider === "vertex"}
                onClick={() =>
                  onProviderChange(
                    provider === "vertex" ? "gemini" : "vertex"
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  provider === "vertex" ? "bg-blue-500" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                    provider === "vertex" ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ) : (
            <div>
              <Label className="text-sm">API Provider</Label>
              <p className="text-xs text-muted-foreground mt-1.5">
                Only one provider is configured. Set both{" "}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">GEMINI_API_KEY</code> and{" "}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">GOOGLE_VERTEX_*</code>{" "}
                env vars to enable switching.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
