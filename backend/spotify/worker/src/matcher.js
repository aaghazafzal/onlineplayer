/**
 * Track matching engine: picks the JioSaavn song that is the *same recording*
 * as a Spotify track. Pure functions only (no network) so it is unit-testable.
 */

// Version markers that make a recording different from the original.
// weight = penalty applied when the marker appears on only one side.
const VERSION_MARKERS = [
  { key: "karaoke", re: /\bkaraoke\b/, weight: 80 },
  { key: "instrumental", re: /\binstrumental\b/, weight: 70 },
  { key: "cover", re: /\bcover(ed)?\b/, weight: 45 },
  { key: "remix", re: /\b(remix|rmx|re-?mix)\b/, weight: 40 },
  { key: "lofi", re: /\blo-?fi\b/, weight: 40 },
  { key: "slowed", re: /\bslowed\b/, weight: 40 },
  { key: "reverb", re: /\breverb\b/, weight: 35 },
  { key: "sped", re: /\bsped up\b|\bspeed up\b|\bnightcore\b/, weight: 40 },
  { key: "8d", re: /\b8d\b/, weight: 40 },
  { key: "mashup", re: /\bmash-?up\b/, weight: 40 },
  { key: "live", re: /\blive\b/, weight: 30 },
  { key: "acoustic", re: /\bacoustic\b/, weight: 30 },
  { key: "unplugged", re: /\bunplugged\b/, weight: 30 },
  { key: "reprise", re: /\breprise\b/, weight: 30 },
  { key: "extended", re: /\bextended\b/, weight: 25 },
  { key: "club", re: /\bclub mix\b|\bdj mix\b/, weight: 25 },
  { key: "female", re: /\bfemale version\b/, weight: 30 },
  { key: "male", re: /\bmale version\b/, weight: 30 },
  { key: "bassboost", re: /\bbass ?boost(ed)?\b/, weight: 35 },
  { key: "radioedit", re: /\bradio edit\b/, weight: 10 },
  { key: "remaster", re: /\bremaster(ed)?\b/, weight: 4 },
];

// Albums that almost always contain re-recordings rather than the original.
const SUSPECT_ALBUM_RE = /\b(covers?|tribute|karaoke|lo-?fi|slowed|reverb|8d|nightcore|made famous|in the style of|instrumentals?|piano versions?|lullaby|workout|party hits|hits of)\b/;

const HTML_ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

export function decodeEntities(str = "") {
  return String(str).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Lowercase, strip accents/punctuation, unify "&"/"and". */
export function normalize(str = "") {
  return decodeEntities(str)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectVersions(text) {
  const n = normalize(text);
  const found = new Set();
  for (const v of VERSION_MARKERS) if (v.re.test(n)) found.add(v.key);
  return found;
}

/**
 * Split a track title into its core name and decorations:
 *   'Kesariya (From "Brahmastra")'      -> base "kesariya", from "brahmastra"
 *   'Tum Hi Ho - From "Aashiqui 2"'     -> base "tum hi ho", from "aashiqui 2"
 *   'Levitating (feat. DaBaby)'         -> base "levitating", feat ["dababy"]
 *   'Mr. Brightside - Live'             -> base "mr brightside", versions {live}
 */
export function parseTitle(rawTitle = "") {
  const title = decodeEntities(rawTitle).trim();
  let from = "";
  const feat = [];

  const fromMatch = title.match(/[\(\[\-–]\s*from\s+(?:the\s+)?(?:(?:film|movie|album|series|motion picture|soundtrack)\s+)?["“'‘]?([^"”'’\)\]]+)["”'’]?/i);
  if (fromMatch) from = normalize(fromMatch[1]);

  // "with" only counts inside brackets, so titles like "Dance With Me" are left alone
  const featMatch =
    title.match(/[\(\[]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^\)\]]+)/i) ||
    title.match(/\b(?:feat\.?|ft\.?|featuring)\s+([^\)\]\-–]+)/i);
  if (featMatch) {
    for (const a of featMatch[1].split(/,|&|\band\b|\bx\b/i)) {
      const na = normalize(a);
      if (na) feat.push(na);
    }
  }

  const base = normalize(
    title
      .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, " ") // (...) and [...]
      .replace(/\s+[-–—]\s+.*$/, " ") // " - Remastered 2011", " - From ..."
      .replace(/\b(?:feat\.?|ft\.?|featuring)\s+.*$/i, " ")
  );

  return { raw: title, base: base || normalize(title), from, feat, versions: detectVersions(title) };
}

function tokens(str) {
  return new Set(normalize(str).split(" ").filter(Boolean));
}

/** Sørensen–Dice over word tokens, 0..1 */
export function tokenSimilarity(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

function artistMatches(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // "arijit singh" vs "arijit singh official", "a r rahman" vs "ar rahman"
  const ca = a.replace(/\s/g, "");
  const cb = b.replace(/\s/g, "");
  if (ca === cb) return true;
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return true;
  return tokenSimilarity(a, b) >= 0.8;
}

/**
 * @param {object} target  { title, artists: string[], album, durationSec, year }
 * @param {object} cand    { title, album, artists: string[], primaryArtists: string[], durationSec, year }
 * @returns {{ score:number, accepted:boolean, reasons:string[], details:object }}
 */
export function scoreCandidate(target, cand) {
  const reasons = [];
  let score = 0;

  const t = parseTitle(target.title);
  const c = parseTitle(cand.title);
  const targetAlbum = normalize(target.album);
  const candAlbum = normalize(cand.album);

  // ---- Title (max 40) ----
  let titleSim = t.base === c.base ? 1 : tokenSimilarity(t.base, c.base);
  // "Kesariya" vs "Kesariya Brahmastra" style: one fully contains the other
  if (titleSim < 1 && t.base && c.base && (` ${c.base} `.includes(` ${t.base} `) || ` ${t.base} `.includes(` ${c.base} `))) {
    titleSim = Math.max(titleSim, 0.75);
  }
  score += Math.round(titleSim * 40);
  reasons.push(`title ${Math.round(titleSim * 100)}%`);

  // ---- Version mismatch (remix / live / cover / lofi ...) ----
  const candVersions = new Set([...c.versions, ...detectVersions(cand.album)]);
  let versionPenalty = 0;
  for (const v of VERSION_MARKERS) {
    const inT = t.versions.has(v.key);
    const inC = candVersions.has(v.key);
    if (inT !== inC) {
      versionPenalty += inC ? v.weight : Math.round(v.weight * 0.6);
      reasons.push(`${inC ? "+" : "-"}${v.key}`);
    }
  }
  if (SUSPECT_ALBUM_RE.test(candAlbum) && !SUSPECT_ALBUM_RE.test(targetAlbum)) {
    versionPenalty += 35;
    reasons.push("suspect-album");
  }
  score -= versionPenalty;

  // ---- Artists (max 30, -35 when nobody matches) ----
  const targetArtists = (target.artists || []).map(normalize).filter(Boolean);
  for (const f of t.feat) if (!targetArtists.includes(f)) targetArtists.push(f);
  const candArtists = [...new Set([...(cand.primaryArtists || []), ...(cand.artists || [])].map(normalize).filter(Boolean))];
  const candPrimary = (cand.primaryArtists || []).map(normalize).filter(Boolean);

  const matched = targetArtists.filter((ta) => candArtists.some((ca) => artistMatches(ta, ca)));
  const primaryHit = targetArtists[0] && candArtists.some((ca) => artistMatches(targetArtists[0], ca));
  // A cover usually credits the original artist only as composer/lyricist, so at least
  // one target artist must be among the candidate's *performing* artists.
  const performerHit =
    !candPrimary.length || targetArtists.some((ta) => candPrimary.some((ca) => artistMatches(ta, ca)));
  const artistMatch = matched.length > 0 && performerHit;
  if (artistMatch) {
    let artistScore = primaryHit ? 25 : 18;
    if (matched.length >= 2) artistScore += 5;
    score += artistScore;
    reasons.push(`artists ${matched.length}/${targetArtists.length}`);
  } else if (matched.length) {
    score -= 20;
    reasons.push("credited-only");
  } else if (targetArtists.length) {
    score -= 35;
    reasons.push("artist-miss");
  }

  // ---- Duration (max 25) ----
  let durationDiff = null;
  if (target.durationSec > 0 && cand.durationSec > 0) {
    durationDiff = Math.abs(target.durationSec - cand.durationSec);
    if (durationDiff <= 2) score += 25;
    else if (durationDiff <= 5) score += 20;
    else if (durationDiff <= 10) score += 10;
    else if (durationDiff <= 20) score += 0;
    else if (durationDiff <= 45) score -= 20;
    else score -= 45;
    reasons.push(`Δ${durationDiff}s`);
  }

  // ---- Album / film (max 15) ----
  const albumRef = targetAlbum || t.from;
  if (albumRef && candAlbum) {
    if (albumRef === candAlbum || (t.from && t.from === candAlbum)) {
      score += 15;
      reasons.push("album=");
    } else if (tokenSimilarity(albumRef, candAlbum) >= 0.6 || (t.from && candAlbum.includes(t.from))) {
      score += 8;
      reasons.push("album~");
    }
  }

  // ---- Release year (max 5) ----
  if (target.year && cand.year && Math.abs(Number(target.year) - Number(cand.year)) <= 1) {
    score += 5;
  }

  const durationOk = durationDiff === null || durationDiff <= 15;
  const accepted = artistMatch && durationOk && titleSim >= 0.5 && versionPenalty < 30 && score >= 60;

  return {
    score,
    accepted,
    reasons,
    details: { titleSim, artistMatch, durationDiff, versionPenalty },
  };
}

/** Rank all candidates; returns best accepted match (or null) plus the ranking for debugging. */
export function pickBestMatch(target, candidates) {
  const ranked = candidates
    .map((cand) => ({ cand, ...scoreCandidate(target, cand) }))
    .sort((a, b) => b.score - a.score || (b.cand.playCount || 0) - (a.cand.playCount || 0));
  const best = ranked.find((r) => r.accepted) || null;
  return { best, ranked };
}

export function confidenceLabel(score) {
  if (score >= 95) return "exact";
  if (score >= 80) return "high";
  return "medium";
}

/** Search queries, most specific first. */
export function buildQueries(target) {
  const t = parseTitle(target.title);
  const primary = target.artists?.[0] || "";
  const cleanTitle = decodeEntities(target.title)
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, " ")
    .replace(/\s+[-–—]\s+.*$/, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If title has "by DJ ..." or "by Artist ...", also produce a version without that clause
  const noDjTitle = cleanTitle.replace(/\bby\s+(?:dj\s+)?[^,\(\[\-]+/i, " ").replace(/\s+/g, " ").trim();

  const queries = [];
  if (primary) queries.push(`${cleanTitle} ${primary}`);
  if (t.from) queries.push(`${cleanTitle} ${t.from}`);
  else if (target.album && normalize(target.album) !== t.base) queries.push(`${cleanTitle} ${target.album}`);
  queries.push(cleanTitle);

  if (noDjTitle && noDjTitle !== cleanTitle) {
    if (primary) queries.push(`${noDjTitle} ${primary}`);
    queries.push(noDjTitle);
  }

  return [...new Set(queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))];
}
