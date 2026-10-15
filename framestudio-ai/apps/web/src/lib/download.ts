/** Baixa um blob como arquivo. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim().slice(0, 120) || 'framestudio';
}

type SavePicker = (o: { suggestedName: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;

/** Escolhe o arquivo de destino (File System Access API), quando disponível. */
export async function pickSaveFile(suggestedName: string, mime: string, ext: string): Promise<FileSystemFileHandle | null> {
  const w = window as unknown as { showSaveFilePicker?: SavePicker };
  if (!w.showSaveFilePicker) return null;
  try {
    return await w.showSaveFilePicker({ suggestedName, types: [{ description: ext.toUpperCase(), accept: { [mime]: [`.${ext}`] } }] });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return null;
  }
}

export function canPickSaveFile(): boolean {
  return 'showSaveFilePicker' in window;
}

/** Abre o seletor de arquivos e devolve os arquivos escolhidos. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    };
    input.addEventListener('cancel', () => {
      resolve([]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
