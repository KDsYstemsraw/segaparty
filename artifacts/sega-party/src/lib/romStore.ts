let romBlobUrl: string | null = null;
let romFileName: string | null = null;

export function setRom(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
    const url = URL.createObjectURL(file);
    romBlobUrl = url;
    romFileName = file.name;
    resolve(url);
  });
}

export function setRomFromUrl(url: string, name: string): void {
  if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
  romBlobUrl = url;
  romFileName = name;
}

export function setRomFromBuffer(buffer: ArrayBuffer, name: string): string {
  if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  romBlobUrl = url;
  romFileName = name;
  return url;
}

export function getRomUrl(): string | null {
  return romBlobUrl;
}

export function getRomName(): string | null {
  return romFileName;
}

export function clearRom() {
  if (romBlobUrl && romBlobUrl.startsWith("blob:")) {
    URL.revokeObjectURL(romBlobUrl);
    romBlobUrl = null;
  }
  romFileName = null;
}

