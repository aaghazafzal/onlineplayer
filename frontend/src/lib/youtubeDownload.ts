import { muxVideoAudio } from "./fmp4mux";

const CHUNK = 8 * 1024 * 1024;
const PARALLEL = 3;

/** Reads one whole format from the worker's /seg route in ranged chunks, a few at a time. */
async function fetchFormat(url: string, total: number, onBytes: (n: number) => void, signal?: AbortSignal): Promise<Uint8Array> {
  const out = new Uint8Array(total);
  const ranges: [number, number][] = [];
  for (let s = 0; s < total; s += CHUNK) ranges.push([s, Math.min(s + CHUNK, total) - 1]);
  let next = 0;

  const worker = async () => {
    while (next < ranges.length) {
      const [start, end] = ranges[next++];
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.length !== end - start + 1) throw new Error("A part of the file came back short");
          out.set(buf, start);
          onBytes(buf.length);
          lastErr = null;
          break;
        } catch (err) {
          if (signal?.aborted) throw err;
          lastErr = err;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (lastErr) throw lastErr;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, ranges.length) }, worker));
  return out;
}

function save(bytes: Uint8Array, type: string, fileName: string) {
  const href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

function clean(name: string) {
  return name.replace(/[\/\\?%*:|"<>\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150) || "video";
}

export interface YtFormat {
  itag: number;
  size: number;
  height?: number;
}

/** Video + audio joined into one MP4 */
export async function downloadYouTubeVideo(
  segBase: string,
  title: string,
  video: YtFormat,
  audio: YtFormat,
  onProgress: (fraction: number, stage: "downloading" | "joining") => void,
  signal?: AbortSignal
) {
  const total = video.size + audio.size;
  let done = 0;
  const tick = (n: number) => {
    done += n;
    onProgress(done / total, "downloading");
  };
  const [v, a] = await Promise.all([
    fetchFormat(`${segBase}/${video.itag}`, video.size, tick, signal),
    fetchFormat(`${segBase}/${audio.itag}`, audio.size, tick, signal),
  ]);
  onProgress(1, "joining");
  // let the progress paint before the (short) synchronous join
  await new Promise((r) => setTimeout(r, 30));
  save(muxVideoAudio(v, a), "video/mp4", `${clean(title)} (${video.height}p).mp4`);
}

export async function downloadYouTubeAudio(
  segBase: string,
  title: string,
  audio: YtFormat & { bitrate?: number },
  onProgress: (fraction: number, stage: "downloading" | "joining") => void,
  signal?: AbortSignal
) {
  let done = 0;
  const a = await fetchFormat(`${segBase}/${audio.itag}`, audio.size, (n) => onProgress((done += n) / audio.size, "downloading"), signal);
  save(a, "audio/mp4", `${clean(title)} (${Math.round((audio.bitrate || 128000) / 1000)}kbps).m4a`);
}
