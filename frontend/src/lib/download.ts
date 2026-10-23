/**
 * Save a file straight from a CORS-enabled CDN (JioSaavn's does), so downloads cost
 * no Worker request. Falls back to the Worker's download URL if the CDN refuses.
 */
export async function saveFromCdn(
  directUrl: string,
  fileName: string,
  fallbackUrl?: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  try {
    const res = await fetch(directUrl, { mode: "cors" });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get("Content-Length")) || 0;
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total && onProgress) onProgress(received / total);
    }
    const blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
    triggerSave(URL.createObjectURL(blob), fileName, true);
  } catch (err) {
    if (!fallbackUrl) throw err;
    triggerSave(fallbackUrl, fileName, false);
  }
}

function triggerSave(href: string, fileName: string, revoke: boolean) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export function audioFileName(artist: string, title: string, bitrate: string, codec?: string) {
  const name = `${artist ? `${artist} - ` : ""}${title} (${bitrate === "preview" ? "preview" : `${bitrate}bps`})`;
  return `${name.replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").trim()}.${codec === "MP3" ? "mp3" : "m4a"}`;
}
