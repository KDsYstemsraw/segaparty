let romBlobUrl: string | null = null;
let romFileName: string | null = null;
let romCore: string | null = null;

function safeRevokeUrl(url: string | null) {
  if (url && url.startsWith("blob:")) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 1500);
  }
}

export function setRom(file: File, core?: string): Promise<string> {
  return new Promise((resolve) => {
    safeRevokeUrl(romBlobUrl);
    const url = URL.createObjectURL(file);
    romBlobUrl = url;
    romFileName = file.name;
    romCore = core || null;
    resolve(url);
  });
}

export function setRomFromUrl(url: string, name: string, core?: string): void {
  safeRevokeUrl(romBlobUrl);
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
  safeRevokeUrl(romBlobUrl);
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
  safeRevokeUrl(romBlobUrl);
  romBlobUrl = null;
  romFileName = null;
  romCore = null;
}
