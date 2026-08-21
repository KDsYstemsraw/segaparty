import React, { useRef, useState } from "react";
import { Upload, FileCode, CheckCircle2, X, FolderOpen, Gamepad2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cleanRomTitle, formatBytes } from "@/lib/romUtils";

interface RomFilePickerProps {
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  compact?: boolean;
}

export function RomFilePicker({ selectedFile, onFileSelected, compact = false }: RomFilePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelected(file);
    }
  };

  const triggerPicker = () => {
    fileInputRef.current?.click();
  };

  const cleanTitle = selectedFile ? cleanRomTitle(selectedFile.name) : "";

  return (
    <div className="w-full font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin,.md,.smd,.gen,.zip"
        onChange={handleInputChange}
        className="hidden"
      />

      {selectedFile ? (
        // Selected File View
        <div className="p-4 rounded-xl border-2 border-primary/70 bg-primary/10 shadow-[0_0_20px_rgba(0,71,187,0.25)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
              <Gamepad2 className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-foreground font-display tracking-wide truncate" title={cleanTitle}>
                  {cleanTitle}
                </h4>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/50 text-primary font-mono">
                  {formatBytes(selectedFile.size)}
                </Badge>
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate max-w-sm sm:max-w-md" title={selectedFile.name}>
                {selectedFile.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={triggerPicker}
              className="h-8 px-3 text-xs font-bold border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Choose Different ROM
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onFileSelected(null)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Remove ROM"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Drag & Drop Area
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerPicker}
          className={`w-full rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center ${
            compact ? "h-32" : "h-44"
          } ${
            isDragging
              ? "border-accent bg-accent/10 scale-[1.01] shadow-[0_0_25px_rgba(224,0,11,0.3)]"
              : "border-primary/40 bg-background/50 hover:border-primary hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(0,71,187,0.2)]"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3">
            <Upload className="w-6 h-6 text-accent" />
          </div>

          <p className="font-bold text-sm text-foreground mb-1">
            Click to Browse or Drag & Drop Sega Genesis ROM
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Pick any file from your computer (e.g., from your local ROM collection)
          </p>

          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border">.BIN</Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border">.MD</Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border">.GEN</Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border">.SMD</Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-border">.ZIP</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
