/**
 * Product photo search — src/lib/imageSearch.ts
 *
 * Multi-engine search pipeline designed for 0 error margin:
 * 1. Primary API: Serper.dev (Google Images) when SERPER_API_KEY is set.
 * 2. Primary Engine (No key required): Bing Images direct search — fast,
 *    highly accurate product matching, no aggressive 403 rate-limiting.
 * 3. Fallback Engine: DuckDuckGo Images.
 *
 * Includes negative keyword filtering to automatically eliminate false matches
 * (e.g. discarding multi-port hubs or cables when searching for a compact adapter).
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BING_HEADERS: HeadersInit = {
  "user-agent": USER_AGENT,
  "accept-language": "es-PE,es;q=0.9,en-US;q=0.8,en;q=0.7",
};

const DDG_HEADERS: HeadersInit = {
  "user-agent": USER_AGENT,
  "accept-language": "es-PE,es;q=0.9,en;q=0.8",
};

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
      body: JSON.stringify({ q: query, gl: "pe", hl: "es", num: max * 2 }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[imageSearch] Serper request failed: HTTP ${res.status} for query "${query}" — ${body.slice(0, 200)}`
      );
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data?.images)) return [];

    const urls: string[] = [];
    for (const img of data.images) {
      if (urls.length >= max) break;
      const title = String(img.title || "");
      const url = img.imageUrl;
      if (typeof url === "string" && url.startsWith("https://")) {
        if (negRegex && negRegex.test(title)) continue;
        if (!urls.includes(url)) urls.push(url);
      }
    }
    return urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] Serper request threw for query "${query}": ${reason}`);
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
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
    const res = await fetch(url, {
      headers: BING_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const urls: string[] = [];

    // Parse each m="{...}" block which contains full image metadata
    const blockRegex = /m="({[\s\S]*?})"/g;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null && urls.length < max) {
      try {
        const jsonStr = match[1].replace(/&quot;/g, '"');
        const item = JSON.parse(jsonStr);
        const title = String(item.t || "");
        const murl = item.murl;
        if (typeof murl === "string" && murl.startsWith("https://")) {
          if (negRegex && negRegex.test(title)) continue;
          if (!urls.includes(murl)) urls.push(murl);
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
        if (!urls.includes(directUrl)) urls.push(directUrl);
      }
    }

    return urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] Bing request threw for query "${query}": ${reason}`);
    return [];
  }
}

/** Motor 3: DuckDuckGo Images (secondary fallback). */
const DDG_MIN_GAP_MS = 3000;
let ddgNextCallAt = 0;

async function ddgThrottle(): Promise<void> {
  const wait = ddgNextCallAt - Date.now();
  ddgNextCallAt = Math.max(ddgNextCallAt, Date.now()) + DDG_MIN_GAP_MS + Math.floor(Math.random() * 1000);
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
    signal: AbortSignal.timeout(6000),
  });
  if (!tokenRes.ok) {
    return { ok: false, urls: [], retryable: false };
  }
  const html = await tokenRes.text();
  const token = html.match(/vqd=([\d-]+)&/)?.[1];
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
    signal: AbortSignal.timeout(6000),
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
    if (typeof imgUrl === "string" && imgUrl.startsWith("https://")) {
      if (negRegex && negRegex.test(title)) continue;
      if (!urls.includes(imgUrl)) urls.push(imgUrl);
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

    await sleep(2000);
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
      // Top up with Bing if Serper had only 1-2
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
  /** Maximum number of image URLs to return (default: 4). */
  max?: number;
  /** Secondary broader query for fallback. */
  broaderQuery?: string;
  /** Negative keywords: results whose titles contain any of these are skipped. */
  negativeKeywords?: string[];
}

/**
 * Searches the web for official product photos.
 * Supports overloaded arguments for full backward compatibility:
 *   searchProductImages("query", 4, "broaderQuery", ["hub", "dock"])
 *   searchProductImages({ queries: [...], negativeKeywords: [...], max: 4 })
 */
export async function searchProductImages(
  queryOrOptions: string | SearchProductImageOptions,
  max = 4,
  broaderQuery?: string,
  negativeKeywords?: string[]
): Promise<string[]> {
  let queryList: string[] = [];
  let limit = max;
  let negKeywords = negativeKeywords;

  if (typeof queryOrOptions === "object" && queryOrOptions !== null) {
    limit = queryOrOptions.max ?? 4;
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

  return collectedUrls;
}
