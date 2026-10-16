import React from "react";
import { ControllerGraphicProps, PsxControllerGraphic } from "./PsxControllerGraphic";
import { SnesControllerGraphic } from "./SnesControllerGraphic";
import { GenesisControllerGraphic } from "./GenesisControllerGraphic";
import { N64ControllerGraphic } from "./N64ControllerGraphic";

export type { ControllerGraphicProps };
export {
  PsxControllerGraphic,
  SnesControllerGraphic,
  GenesisControllerGraphic,
  N64ControllerGraphic,
};

export interface UniversalControllerGraphicProps extends ControllerGraphicProps {
  core?: string | null;
}

export function UniversalControllerGraphic({
  core = "segaMD",
  activeButtons,
  highlightButton,
  onButtonClick,
  className,
}: UniversalControllerGraphicProps) {
  const normalizedCore = (core || "segaMD").toLowerCase().trim();

  switch (normalizedCore) {
    case "psx":
    case "ps1":
    case "playstation":
      return (
        <PsxControllerGraphic
          activeButtons={activeButtons}
          highlightButton={highlightButton}
          onButtonClick={onButtonClick}
          className={className}
        />
      );

    case "snes":
    case "supernintendo":
    case "sfc":
    case "nes":
    case "famicom":
    case "gba":
    case "gb":
    case "gbc":
      return (
        <SnesControllerGraphic
          activeButtons={activeButtons}
          highlightButton={highlightButton}
          onButtonClick={onButtonClick}
          className={className}
        />
      );

    case "n64":
    case "nintendo64":
    case "mupen64plus":
      return (
        <N64ControllerGraphic
          activeButtons={activeButtons}
          highlightButton={highlightButton}
          onButtonClick={onButtonClick}
          className={className}
        />
      );

    case "segamd":
    case "genesis":
    case "megadrive":
    case "segacd":
    case "sega32x":
    case "segams":
    case "segagg":
    case "arcade":
    default:
      return (
        <GenesisControllerGraphic
          activeButtons={activeButtons}
          highlightButton={highlightButton}
          onButtonClick={onButtonClick}
          className={className}
        />
      );
  }
}
