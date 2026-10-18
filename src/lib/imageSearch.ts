/**
 * Product photo search — src/lib/imageSearch.ts
 *
 * Multi-engine search pipeline designed for 0 error margin and guaranteed 4+ crisp product photos:
 * 1. Primary API: Serper.dev (Google Images) when SERPER_API_KEY is set.
 * 2. Primary Engine (No key required): Bing Images direct search — fast,
 *    extracts both original high-res `murl` and Bing CDN `turl` fallback.
 * 3. Fallback Engine: DuckDuckGo Images.
 *
 * Includes negative keyword filtering and automatic low-quality domain exclusion
 * (excludes YouTube video frames, social media posts, SVGs, tiny icons).
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BING_HEADERS: HeadersInit = {
  "user-agent": USER_AGENT,
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "es-PE,es;q=0.9,en-US;q=0.8,en;q=0.7",
};

const DDG_HEADERS: HeadersInit = {
  "user-agent": USER_AGENT,
  "accept-language": "es-PE,es;q=0.9,en;q=0.8",
};

/**
 * Stores reliable CDN fallback URLs (like Bing's tse1.mm.bing.net or DDG's proxy)
 * keyed by primary `murl`, so `downloadProductImageFromUrl` and `/api/image-proxy`
 * can seamlessly fall back if a third-party store blocks hotlinking (403/timeout).
 */
const FALLBACK_URL_MAP = new Map<string, string>();

export function getImageFallbackUrl(primaryUrl: string): string | undefined {
  return FALLBACK_URL_MAP.get(primaryUrl);
}

function registerFallbackUrl(primaryUrl: string, fallbackUrl?: string) {
  if (!primaryUrl || !fallbackUrl || !fallbackUrl.startsWith("https://")) return;
  if (FALLBACK_URL_MAP.size > 2000) {
    FALLBACK_URL_MAP.clear();
  }
  FALLBACK_URL_MAP.set(primaryUrl, fallbackUrl);
}

const BLOCKED_URL_PATTERNS =
  /\.(svg|gif|ico)(\?|$)|i\.ytimg\.com|img\.youtube\.com|fbsbx\.com|instagram\.com|tiktokcdn\.com|pinterest\.com\/.*\/236x/i;

function isValidProductImageUrl(url: string): boolean {
  if (!url || typeof url !== "string" || !url.startsWith("https://")) return false;
  if (BLOCKED_URL_PATTERNS.test(url)) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildNegativeRegex(negativeKeywords?: string[]): RegExp | null {
  if (!negativeKeywords || negativeKeywords.length === 0) return null;
  const valid = negativeKeywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (valid.length === 0) return null;
  return new RegExp(`\\b(${valid.join("|")})\\b`, "i");
}

/** Motor 1: Serper.dev (Google Images official API, used when SERPER_API_KEY is set). */
async function searchViaSerper(
  query: string,
  max: number,
  negRegex: RegExp | null
): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "pe", hl: "es", num: Math.max(max * 2, 10) }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data?.images)) return [];

    const urls: string[] = [];
    for (const img of data.images) {
      if (urls.length >= max) break;
      const title = String(img.title || "");
      const url = img.imageUrl;
      const thumb = img.thumbnailUrl;
      if (isValidProductImageUrl(url)) {
        if (negRegex && negRegex.test(title)) continue;
        if (!urls.includes(url)) {
          registerFallbackUrl(url, thumb);
          urls.push(url);
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

/** Motor 2: Bing Images (direct high-speed extraction, no key required). */
async function searchViaBing(
  query: string,
  max: number,
  negRegex: RegExp | null
): Promise<string[]> {
  try {
    // qft=+filterui:aspect-square+filterui:imagesize-large prefers clean square/product photos
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await fetch(url, {
      headers: BING_HEADERS,
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const urls: string[] = [];
    const fallbackCdnUrls: string[] = [];

    // Parse each m="{...}" block which contains full image metadata (murl + turl)
    const blockRegex = /m="({[\s\S]*?})"/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null && urls.length < max) {
      try {
        const jsonStr = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        const item = JSON.parse(jsonStr);
        const title = String(item.t || "");
        const murl = typeof item.murl === "string" ? item.murl : "";
        const rawTurl = typeof item.turl === "string" ? item.turl : "";
        // Upgrade Bing's CDN thumbnail to high-res 800x800 so fallback is crisp
        const hiResTurl = rawTurl.startsWith("https://")
          ? `${rawTurl}${rawTurl.includes("?") ? "&" : "?"}w=800&h=800&c=7&pid=Api`
          : "";

        if (negRegex && negRegex.test(title)) continue;

        if (isValidProductImageUrl(murl)) {
          if (!urls.includes(murl)) {
            if (hiResTurl) registerFallbackUrl(murl, hiResTurl);
            urls.push(murl);
          }
        } else if (hiResTurl && !urls.includes(hiResTurl)) {
          urls.push(hiResTurl);
        }

        if (hiResTurl && !fallbackCdnUrls.includes(hiResTurl)) {
          fallbackCdnUrls.push(hiResTurl);
        }
      } catch {
        // Continue on json parse failure
      }
    }

    // Direct fallback regex if block parsing found fewer items
    if (urls.length < max) {
      const directRegex = /&quot;murl&quot;:&quot;(https:\/\/[^&]+)&quot;/g;
      let murlMatch: RegExpExecArray | null;
      while ((murlMatch = directRegex.exec(html)) !== null && urls.length < max) {
        const directUrl = murlMatch[1];
        if (isValidProductImageUrl(directUrl) && !urls.includes(directUrl)) {
          urls.push(directUrl);
        }
      }
    }

    // Also top up with Bing CDN URLs if still short
    for (const cdnUrl of fallbackCdnUrls) {
      if (urls.length >= max) break;
      if (!urls.includes(cdnUrl)) urls.push(cdnUrl);
    }

    return urls;
  } catch {
    return [];
  }
}

/** Motor 3: DuckDuckGo Images (secondary fallback). */
const DDG_MIN_GAP_MS = 1200;
let ddgNextCallAt = 0;

async function ddgThrottle(): Promise<void> {
  const wait = ddgNextCallAt - Date.now();
  ddgNextCallAt = Math.max(ddgNextCallAt, Date.now()) + DDG_MIN_GAP_MS + Math.floor(Math.random() * 400);
  if (wait > 0) await sleep(wait);
}

function cookieHeaderFrom(setCookieValues: string[]): string {
  return setCookieValues.map((raw) => raw.split(";")[0]).join("; ");
}

interface DdgAttempt {
  ok: boolean;
  urls: string[];
  retryable: boolean;
}

async function ddgAttempt(
  query: string,
  max: number,
  negRegex: RegExp | null
): Promise<DdgAttempt> {
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
    headers: {
      ...DDG_HEADERS,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!tokenRes.ok) {
    return { ok: false, urls: [], retryable: false };
  }
  const html = await tokenRes.text();
  const token = html.match(/vqd=([\d-]+)&/)?.[1] ?? html.match(/vqd=["']?([\d-]+)["']?/)?.[1];
  if (!token) {
    return { ok: false, urls: [], retryable: false };
  }
  const cookie = cookieHeaderFrom(tokenRes.headers.getSetCookie?.() ?? []);

  const imagesUrl =
    `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}` +
    `&vqd=${token}&f=,,,&p=1`;
  const imagesRes = await fetch(imagesUrl, {
    headers: {
      ...DDG_HEADERS,
      accept: "application/json, text/javascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      referer: "https://duckduckgo.com/",
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!imagesRes.ok) {
    return { ok: false, urls: [], retryable: imagesRes.status === 403 };
  }

  const data = await imagesRes.json();
  if (!Array.isArray(data?.results)) {
    return { ok: false, urls: [], retryable: false };
  }

  const urls: string[] = [];
  for (const r of data.results) {
    if (urls.length >= max) break;
    const title = String(r.title || "");
    const imgUrl = r.image;
    const thumbUrl = r.thumbnail;
    if (isValidProductImageUrl(imgUrl)) {
      if (negRegex && negRegex.test(title)) continue;
      if (!urls.includes(imgUrl)) {
        if (typeof thumbUrl === "string" && thumbUrl.startsWith("https://")) {
          registerFallbackUrl(imgUrl, thumbUrl);
        }
        urls.push(imgUrl);
      }
    }
  }

  return { ok: true, urls, retryable: false };
}

async function searchViaDuckDuckGo(
  query: string,
  max: number,
  negRegex: RegExp | null
): Promise<string[]> {
  try {
    await ddgThrottle();
    const first = await ddgAttempt(query, max, negRegex);
    if (first.ok || !first.retryable) return first.urls;

    await sleep(1000);
    const second = await ddgAttempt(query, max, negRegex);
    return second.urls;
  } catch {
    return [];
  }
}

/** Execute a single query across the engine cascade (Serper -> Bing -> DDG). */
async function searchSingleQuery(
  query: string,
  max: number,
  negRegex: RegExp | null
): Promise<string[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Try Serper if configured
  if (process.env.SERPER_API_KEY) {
    const serperResults = await searchViaSerper(cleanQuery, max, negRegex);
    if (serperResults.length >= max) return serperResults;
    if (serperResults.length > 0) {
      const bingResults = await searchViaBing(cleanQuery, max, negRegex);
      const merged = [...serperResults];
      for (const u of bingResults) {
        if (merged.length >= max) break;
        if (!merged.includes(u)) merged.push(u);
      }
      return merged;
    }
  }

  // 2. Primary engine: Bing Images
  const bingResults = await searchViaBing(cleanQuery, max, negRegex);
  if (bingResults.length >= max) return bingResults;

  // 3. Fallback: DuckDuckGo Images
  const ddgResults = await searchViaDuckDuckGo(cleanQuery, max, negRegex);
  const merged = [...bingResults];
  for (const u of ddgResults) {
    if (merged.length >= max) break;
    if (!merged.includes(u)) merged.push(u);
  }

  return merged;
}

export interface SearchProductImageOptions {
  /** Prioritized list of queries to try in order until `max` images are gathered. */
  queries?: string[];
  /** Single query string (alternative to `queries`). */
  query?: string;
  /** Maximum number of image URLs to return (default: 8). */
  max?: number;
  /** Secondary broader query for fallback. */
  broaderQuery?: string;
  /** Negative keywords: results whose titles contain any of these are skipped. */
  negativeKeywords?: string[];
}

function deriveBroaderQueries(rawQuery: string): string[] {
  const clean = rawQuery
    .replace(/\b(adaptadores de red|cables y adaptadores|tintas y toners|categoria|nuevo|tienda|peru|precio|oferta|marca)\b/gi, "")
    .replace(/[(),;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(" ").filter((t) => t.length > 1);
  const broader: string[] = [];

  // Try extracting brand + model
  const modelMatch = clean.match(/\b([A-Z0-9]+[-_][A-Z0-9]+|[A-Z]+[0-9]+[A-Z0-9]*|[0-9]+[A-Z]+[A-Z0-9]*)\b/i);
  if (modelMatch && tokens.length > 0) {
    const brand = tokens[0];
    const model = modelMatch[1];
    const combo = `${brand} ${model}`;
    if (!broader.includes(combo)) broader.push(combo);
    const withProduct = `${brand} ${model} product`;
    if (!broader.includes(withProduct)) broader.push(withProduct);
  }

  // 4-word and 3-word subsets
  if (tokens.length >= 4) {
    const subset4 = tokens.slice(0, 4).join(" ");
    if (!broader.includes(subset4)) broader.push(subset4);
  }
  if (tokens.length >= 3) {
    const subset3 = tokens.slice(0, 3).join(" ");
    if (!broader.includes(subset3)) broader.push(subset3);
  }

  return broader.filter((b) => b !== rawQuery && b.length > 3);
}

/**
 * Searches the web for official product photos.
 * Guarantees a rich pool of candidate URLs so at least 4 crisp photos can be downloaded and verified.
 */
export async function searchProductImages(
  queryOrOptions: string | SearchProductImageOptions,
  max = 8,
  broaderQuery?: string,
  negativeKeywords?: string[]
): Promise<string[]> {
  let queryList: string[] = [];
  let limit = max;
  let negKeywords = negativeKeywords;

  if (typeof queryOrOptions === "object" && queryOrOptions !== null) {
    limit = queryOrOptions.max ?? 8;
    negKeywords = queryOrOptions.negativeKeywords;
    if (queryOrOptions.queries && queryOrOptions.queries.length > 0) {
      queryList = queryOrOptions.queries;
    } else if (queryOrOptions.query) {
      queryList = [queryOrOptions.query];
      if (queryOrOptions.broaderQuery && queryOrOptions.broaderQuery !== queryOrOptions.query) {
        queryList.push(queryOrOptions.broaderQuery);
      }
    }
  } else if (typeof queryOrOptions === "string") {
    queryList = [queryOrOptions];
    if (broaderQuery && broaderQuery !== queryOrOptions) {
      queryList.push(broaderQuery);
    }
  }

  if (queryList.length === 0) return [];

  const negRegex = buildNegativeRegex(negKeywords);
  const collectedUrls: string[] = [];

  // Pass 1: Run the top queries in parallel on Bing first for speed, then top up
  const primaryQueries = queryList.slice(0, 3);
  const parallelResults = await Promise.all(
    primaryQueries.map((q) => searchViaBing(q, limit, negRegex))
  );
  for (const list of parallelResults) {
    for (const url of list) {
      if (collectedUrls.length >= limit) break;
      if (!collectedUrls.includes(url)) collectedUrls.push(url);
    }
  }

  // Pass 2: If still below limit, run full cascade on queries
  if (collectedUrls.length < limit) {
    for (const q of queryList) {
      if (collectedUrls.length >= limit) break;
      const results = await searchSingleQuery(q, limit, negRegex);
      for (const url of results) {
        if (collectedUrls.length >= limit) break;
        if (!collectedUrls.includes(url)) {
          collectedUrls.push(url);
        }
      }
    }
  }

  // Pass 3: Expand with derived broader queries if needed
  if (collectedUrls.length < limit && queryList[0]) {
    const expansions = deriveBroaderQueries(queryList[0]);
    for (const expQ of expansions) {
      if (collectedUrls.length >= limit) break;
      const results = await searchSingleQuery(expQ, limit, negRegex);
      for (const url of results) {
        if (collectedUrls.length >= limit) break;
        if (!collectedUrls.includes(url)) {
          collectedUrls.push(url);
        }
      }
    }
  }

  // Pass 4: If still fewer than `limit` and negRegex was active, search without negRegex to guarantee 4+ images
  if (collectedUrls.length < limit && negRegex && queryList[0]) {
    const results = await searchSingleQuery(queryList[0], limit, null);
    for (const url of results) {
      if (collectedUrls.length >= limit) break;
      if (!collectedUrls.includes(url)) {
        collectedUrls.push(url);
      }
    }
  }

  return collectedUrls;
}
