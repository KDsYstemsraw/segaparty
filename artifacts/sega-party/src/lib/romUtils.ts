/**
 * Converts ROM filenames into clean readable game titles
 * e.g., "Adventures of Batman and Robin, The (E).bin" -> "The Adventures of Batman and Robin"
 * e.g., "Sonic The Hedgehog 2 (W) (REV01) [!].bin" -> "Sonic The Hedgehog 2"
 */
export function cleanRomTitle(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  let name = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;

  // Remove trailing dump tags like (U), (E), (J), (W), (REV01), [!], [b1], [c], (Unl), etc.
  name = name.replace(/\s*\([^)]*\)/g, "");
  name = name.replace(/\s*\[[^\]]*\]/g, "");

  // Handle ", The", ", A" at the end of the name
  if (name.includes(", The")) {
    name = "The " + name.replace(", The", "");
  } else if (name.includes(", A")) {
    name = "A " + name.replace(", A", "");
  }

  return name.trim() || filename;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
