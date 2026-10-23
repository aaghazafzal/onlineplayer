/**
 * End-to-end checks for every OnlinePlayer service. Each check exercises the
 * real user path (resolve -> playable stream), not just a /health endpoint.
 *
 * "deep" runs (hourly) bypass the provider caches with refresh=1 so a broken
 * extractor is caught even while old results are still cached.
 */

const ORIGIN = "https://onlineplayer.site";
const UA = "OnlinePlayer-Monitor/1.0 (+https://status.onlineplayer.site)";

// Stable public test inputs
const TERABOX_TEST_LINK = "https://1024terabox.com/s/1LNr3tyl5pI5KUM8BecGtyQ";
const INSTAGRAM_TEST_LINK = "https://www.instagram.com/p/DerUlPplt8G/";
// Indian catalogue track: JioSaavn returns it from any region, so the check
// does not depend on the monitor's own IP country.
const SPOTIFY_TEST_LINK = "https://open.spotify.com/track/6VBhH7CyP56BXjp8VsDFPZ";
const JIOSAAVN_TEST_LINK = "https://www.jiosaavn.com/song/kesariya/AgIAQyBeWlI";
const YOUTUBE_TEST_ID = "dQw4w9WgXcQ";
const YOUTUBE_TEST_LINK = `https://www.youtube.com/watch?v=${YOUTUBE_TEST_ID}`;

class CheckError extends Error {}

async function get(url, { timeoutMs = 25000, headers = {} } = {}) {
  return fetch(url, {
    headers: { "User-Agent": UA, Origin: ORIGIN, Referer: `${ORIGIN}/`, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function getJson(url, opts) {
  const res = await get(url, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new CheckError(`HTTP ${res.status}, response is not JSON`);
  }
  return { res, data };
}

function assert(cond, message) {
  if (!cond) throw new CheckError(message);
}

export const CHECKS = [
  {
    id: "site",
    name: "Website (onlineplayer.site)",
    async run() {
      const res = await get(ORIGIN);
      assert(res.ok, `HTTP ${res.status}`);
      const html = await res.text();
      assert(html.includes("OnlinePlayer"), "Page loaded but content looks wrong");
    },
  },
  {
    id: "terabox",
    name: "TeraBox player",
    async run({ deep }) {
      const { res, data } = await getJson(
        `https://terabox.onlineplayer.site/api/resolve?url=${encodeURIComponent(TERABOX_TEST_LINK)}${deep ? "&refresh=1" : ""}`,
        { timeoutMs: 45000 }
      );
      assert(res.ok && data.ok, `Resolve failed: ${data.error || `HTTP ${res.status}`}`);
      const streamUrl = data.files?.[0]?.stream_url;
      assert(streamUrl, "Resolve returned no stream URL");
      const playlist = await get(streamUrl);
      assert(playlist.ok, `Playlist HTTP ${playlist.status}`);
      const body = await playlist.text();
      assert(body.startsWith("#EXTM3U"), "Playlist is not a valid HLS (m3u8) file");
    },
  },
  {
    id: "resolver",
    name: "TeraBox cloud resolver (Render)",
    async run() {
      // Free Render instances can take ~50s to wake up
      const res = await get("https://terabox-resolver-csit.onrender.com/health", { timeoutMs: 60000 });
      assert(res.ok, `HTTP ${res.status}`);
    },
  },
  {
    id: "instagram",
    name: "Instagram downloader",
    async run({ deep }) {
      const { res, data } = await getJson(
        `https://instagram.onlineplayer.site/api/resolve?url=${encodeURIComponent(INSTAGRAM_TEST_LINK)}${deep ? "&refresh=1" : ""}`,
        { timeoutMs: 40000 }
      );
      assert(res.ok && data.status === "success", `Resolve failed: ${data.error || `HTTP ${res.status}`}`);
      assert(Array.isArray(data.medias) && data.medias.length > 0, "No media returned");
    },
  },
  {
    id: "spotify",
    name: "Spotify full-length audio",
    async run({ deep }) {
      const { res, data } = await getJson(
        `https://spotify.onlineplayer.site/api/resolve?url=${encodeURIComponent(SPOTIFY_TEST_LINK)}${deep ? "&refresh=1" : ""}`,
        { timeoutMs: 40000 }
      );
      assert(res.ok && data.ok, `Resolve failed: ${data.error || `HTTP ${res.status}`}`);
      assert(data.isFullLength, "Only the 30s preview was found (full-length matching is broken)");
      const audio = await get(data.streamUrl, { headers: { Range: "bytes=0-1023" } });
      assert(audio.status === 206, `Audio stream returned HTTP ${audio.status} instead of 206`);
      await audio.body?.cancel();
    },
  },
  {
    id: "jiosaavn",
    name: "JioSaavn songs",
    async run({ deep }) {
      const { res, data } = await getJson(
        `https://jiosaavn.onlineplayer.site/api/resolve?url=${encodeURIComponent(JIOSAAVN_TEST_LINK)}${deep ? "&refresh=1" : ""}`,
        { timeoutMs: 40000 }
      );
      assert(res.ok && data.ok, `Resolve failed: ${data.error || `HTTP ${res.status}`}`);
      const stream = data.streams?.[0]?.streamUrl;
      assert(stream, "No stream returned");
      const audio = await get(stream, { headers: { Range: "bytes=0-1023" } });
      assert(audio.status === 206, `Audio CDN returned HTTP ${audio.status} instead of 206`);
      await audio.body?.cancel();
    },
  },
  {
    // Link resolving, then the ad-free stream down to the first media bytes
    id: "youtube",
    name: "YouTube ad-free",
    async run({ deep }) {
      const { res, data } = await getJson(
        `https://youtube.onlineplayer.site/api/resolve?url=${encodeURIComponent(YOUTUBE_TEST_LINK)}${deep ? "&refresh=1" : ""}`,
        { timeoutMs: 30000 }
      );
      assert(res.ok && data.ok && data.title, `Resolve failed: ${data.error || `HTTP ${res.status}`}`);
      const streams = await getJson(`https://youtube.onlineplayer.site/api/streams?v=${YOUTUBE_TEST_ID}`, { timeoutMs: 40000 });
      assert(streams.res.ok && streams.data.ok && streams.data.hls, `Ad-free stream unavailable: ${streams.data.error || `HTTP ${streams.res.status}`}`);
      const audio = streams.data.audio;
      const seg = await get(`${streams.data.segBase}/${audio.itag}`, { headers: { Range: "bytes=0-1023" } });
      assert(seg.status === 206, `Segment returned HTTP ${seg.status} instead of 206`);
      await seg.body?.cancel();
    },
  },
];

/** Run every check in parallel; never throws. */
export async function runAllChecks({ deep = false } = {}) {
  return Promise.all(
    CHECKS.map(async (check) => {
      const started = Date.now();
      try {
        await check.run({ deep });
        return { id: check.id, name: check.name, ok: true, latencyMs: Date.now() - started };
      } catch (err) {
        const error =
          err?.name === "TimeoutError" ? "Timed out" : err instanceof CheckError ? err.message : `${err?.name || "Error"}: ${err?.message || err}`;
        return { id: check.id, name: check.name, ok: false, latencyMs: Date.now() - started, error };
      }
    })
  );
}
