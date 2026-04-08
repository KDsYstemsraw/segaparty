let romBlobUrl: string | null = null;
let romFileName: string | null = null;

export function setRom(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    romBlobUrl = url;
    romFileName = file.name;
    resolve(url);
  });
}

export function getRomUrl(): string | null {
  return romBlobUrl;
}

export function getRomName(): string | null {
  return romFileName;
}

export function clearRom() {
  if (romBlobUrl) {
    URL.revokeObjectURL(romBlobUrl);
    romBlobUrl = null;
  }
  romFileName = null;
}
