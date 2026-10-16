let romBlobUrl: string | null = null;
let romFileName: string | null = null;
let romCore: string | null = null;

export function setRom(file: File, core?: string): Promise<string> {
  return new Promise((resolve) => {
    if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
    const url = URL.createObjectURL(file);
    romBlobUrl = url;
    romFileName = file.name;
    romCore = core || null;
    resolve(url);
  });
}

export function setRomFromUrl(url: string, name: string, core?: string): void {
  if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
  romBlobUrl = url;
  romFileName = name;
  romCore = core || null;
}

export function setRomCore(core: string): void {
  romCore = core;
}

export function getRomCore(): string | null {
  return romCore;
}

export function setRomFromBuffer(buffer: ArrayBuffer, name: string, core?: string): string {
  if (romBlobUrl && romBlobUrl.startsWith("blob:")) URL.revokeObjectURL(romBlobUrl);
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  romBlobUrl = url;
  romFileName = name;
  romCore = core || null;
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
  romCore = null;
}
