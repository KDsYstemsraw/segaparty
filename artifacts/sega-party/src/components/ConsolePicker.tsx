import React from "react";
import {
  SUPPORTED_CONSOLES,
  ConsoleSystem,
  getConsoleSystem,
} from "@/lib/consoles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsolePickerProps {
  selectedCore: string;
  onSelectCore: (coreId: string) => void;
  detectedCore?: string;
  className?: string;
}

export function ConsolePicker({
  selectedCore,
  onSelectCore,
  detectedCore,
  className,
}: ConsolePickerProps) {
  const currentSys = getConsoleSystem(selectedCore);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Gamepad2 className="w-3.5 h-3.5 text-primary" />
          Emulation Core / Console
        </label>
        {detectedCore && detectedCore === selectedCore && (
          <span className="text-[10px] font-sans font-bold text-accent flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Auto-detected
          </span>
        )}
      </div>

      <Select value={selectedCore} onValueChange={onSelectCore}>
        <SelectTrigger className="w-full bg-muted/40 border-primary/30 h-10 font-sans focus:ring-primary">
          <SelectValue>
            <div className="flex items-center gap-2 truncate">
              <Badge
                variant="outline"
                className={cn("text-[10px] font-bold py-0 px-1.5 uppercase", currentSys.badgeColor)}
              >
                {currentSys.shortName}
              </Badge>
              <span className="font-bold text-sm text-foreground truncate">{currentSys.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-80 z-50">
          {SUPPORTED_CONSOLES.map((c) => {
            const isDetected = detectedCore === c.id;
            return (
              <SelectItem key={c.id} value={c.id} className="cursor-pointer py-2 font-sans">
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-2 truncate">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-bold py-0 px-1.5 shrink-0 uppercase", c.badgeColor)}
                    >
                      {c.shortName}
                    </Badge>
                    <span className="text-xs font-bold text-foreground truncate">{c.name}</span>
                  </div>
                  {isDetected && (
                    <span className="text-[10px] font-mono text-accent shrink-0 font-bold">
                      (Auto-detected)
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
