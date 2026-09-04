/**
 * Product photo search — src/lib/imageSearch.ts
 *
 * Primary path: Serper.dev (https://serper.dev), an official Google Images
 * API — used whenever SERPER_API_KEY is set. Reliable, no anti-bot
 * blocking, 2,500 free searches then cheap pay-as-you-go top-ups (see
 * .env.example for setup).
 *
 * Fallback path: DuckDuckGo's own (undocumented, public) image endpoint
 * via plain `fetch` — used only when SERPER_API_KEY isn't configured, so
 * this feature still does *something* for anyone who hasn't set up Serper
 * yet. Kept working as well as scraping an actively bot-hostile endpoint
 * can be made to work, but it is NOT reliable under real usage (see the
 * history below) — treat it as a stopgap, not the real fix.
 *
 * Shared by both product-photo flows: the barcode scanner's fallback when
 * a listing has no photo (scan-actions.ts), and the Alta Rápida quick-add
 * scanner (api/scanner/route.ts).
 *
 * DuckDuckGo fallback history (kept as context for why it's shaped this
 * way, in case Serper is ever unset and this path matters again):
 * - CONFIRMED IN PRODUCTION (2026-09-04): the image endpoint (i.js) 403'd
 *   from the VPS's IP even though the token page (step 1) succeeded —
 *   fixed by forwarding the session cookie DuckDuckGo sets on step 1 to
 *   step 2 (a plain fetch() never carries cookies between two separate
 *   calls on its own).
 * - After that fix, a handful of searches in a row still went back to
 *   403 — DuckDuckGo throttling by request *rate*, not just IP: adding
 *   several products back-to-back (the normal admin workflow) was enough
 *   to trip it. Mitigated with a minimum gap between calls plus one retry
 *   on a fresh token/cookie — raises the odds, but DuckDuckGo can still
 *   hard-block the IP outright, which is exactly why Serper is now the
 *   primary path instead of continuing to patch this.
 */
const DDG_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "accept-language": "es-PE,es;q=0.9,en;q=0.8",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchViaSerper(fullQuery: string, max: number): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: fullQuery, gl: "pe", hl: "es", num: max }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[imageSearch] Serper request failed: HTTP ${res.status} for query "${fullQuery}" — ${body.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data?.images)) {
      console.error(`[imageSearch] unexpected Serper response shape for query "${fullQuery}":`, JSON.stringify(data).slice(0, 300));
      return [];
    }

    const urls = data.images
      .slice(0, max)
      .map((img: { imageUrl?: string }) => img.imageUrl)
      .filter((url: unknown): url is string => typeof url === "string" && url.startsWith("https://"));

    if (urls.length === 0) {
      console.error(`[imageSearch] Serper returned ${data.images.length} result(s) but none had a usable https imageUrl for query "${fullQuery}".`);
    }
    return urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] Serper request threw for query "${fullQuery}": ${reason}`);
    return [];
  }
}

/** DuckDuckGo's Set-Cookie values are full `name=value; Domain=...; Path=...`
 *  attribute strings — a request Cookie header only wants the `name=value`
 *  part of each, joined with "; ". */
function cookieHeaderFrom(setCookieValues: string[]): string {
  return setCookieValues.map((raw) => raw.split(";")[0]).join("; ");
}

// Module-level (per Node process — this app runs a single PM2 fork
// instance) minimum gap enforced between DuckDuckGo calls, regardless of
// how many admins/tabs trigger a search at once. A few seconds of jitter
// on top so consecutive requests don't land at an exact, bot-like cadence.
const DDG_MIN_GAP_MS = 4000;
let ddgNextCallAt = 0;

async function ddgThrottle(): Promise<void> {
  const wait = ddgNextCallAt - Date.now();
  ddgNextCallAt = Math.max(ddgNextCallAt, Date.now()) + DDG_MIN_GAP_MS + Math.floor(Math.random() * 1500);
  if (wait > 0) await sleep(wait);
}

interface DdgAttempt {
  ok: boolean;
  urls: string[];
  /** True only for a 403 on step 2 specifically — the one failure mode a
   *  fresh-session retry has any real chance of recovering from. */
  retryable: boolean;
}

async function ddgAttempt(fullQuery: string, max: number): Promise<DdgAttempt> {
  // Step 1: DuckDuckGo's HTML search page embeds a short-lived "vqd"
  // token in an inline script — the image endpoint rejects requests
  // without a valid one. It also sets a session cookie that step 2
  // requires — captured via getSetCookie(), available on Node's built-in
  // fetch since Node 18.14.
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}`, {
    headers: {
      ...DDG_HEADERS,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!tokenRes.ok) {
    console.error(
      `[imageSearch] DuckDuckGo token request failed: HTTP ${tokenRes.status} for query "${fullQuery}" — they may be blocking this server's IP.`
    );
    return { ok: false, urls: [], retryable: false };
  }
  const html = await tokenRes.text();
  const token = html.match(/vqd=([\d-]+)&/)?.[1];
  if (!token) {
    console.error(
      `[imageSearch] could not extract DuckDuckGo's "vqd" token for query "${fullQuery}" — they likely changed their markup, the scraping regex needs updating.`
    );
    return { ok: false, urls: [], retryable: false };
  }
  const cookie = cookieHeaderFrom(tokenRes.headers.getSetCookie());

  // Step 2: the actual image search, moderate filter on (p=1).
  const imagesUrl =
    `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(fullQuery)}` +
    `&vqd=${token}&f=,,,&p=1`;
  const imagesRes = await fetch(imagesUrl, {
    headers: {
      ...DDG_HEADERS,
      accept: "application/json, text/javascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      referer: "https://duckduckgo.com/",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!imagesRes.ok) {
    console.error(`[imageSearch] DuckDuckGo image request failed: HTTP ${imagesRes.status} for query "${fullQuery}".`);
    return { ok: false, urls: [], retryable: imagesRes.status === 403 };
  }

  const data = await imagesRes.json();
  if (!Array.isArray(data?.results)) {
    console.error(`[imageSearch] unexpected DuckDuckGo response shape for query "${fullQuery}":`, JSON.stringify(data).slice(0, 300));
    return { ok: false, urls: [], retryable: false };
  }

  const urls = data.results
    .slice(0, max)
    .map((r: { image?: string }) => r.image)
    .filter((url: unknown): url is string => typeof url === "string" && url.startsWith("https://"));

  if (urls.length === 0) {
    console.error(`[imageSearch] DuckDuckGo returned ${data.results.length} result(s) but none had a usable https image URL for query "${fullQuery}".`);
  }
  return { ok: true, urls, retryable: false };
}

async function searchViaDuckDuckGo(fullQuery: string, max: number): Promise<string[]> {
  try {
    await ddgThrottle();
    const first = await ddgAttempt(fullQuery, max);
    if (first.ok || !first.retryable) return first.urls;

    // A 403 specifically on step 2 can mean "this particular session got
    // flagged" rather than "this IP is fully blocked" — one retry on a
    // brand-new token/cookie is cheap and occasionally recovers it.
    console.error(`[imageSearch] retrying DuckDuckGo once with a fresh session for query "${fullQuery}".`);
    await sleep(2000 + Math.floor(Math.random() * 1000));
    const second = await ddgAttempt(fullQuery, max);
    return second.urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] DuckDuckGo request threw for query "${fullQuery}": ${reason}`);
    return [];
  }
}

async function runSearch(query: string, max: number): Promise<string[]> {
  const fullQuery = `${query} isolated white background product`;
  if (process.env.SERPER_API_KEY) {
    return searchViaSerper(fullQuery, max);
  }
  return searchViaDuckDuckGo(fullQuery, max);
}

/**
 * `query` is usually name+color+category (see scan-actions.ts) — good for
 * precision, but a search engine can have very few indexed photos for that
 * exact combination (a specific ink color, a store-specific category name
 * appended in Spanish), leaving the admin with just 1-2 options instead of
 * `max`. When that happens, retry with `broaderQuery` (typically just the
 * bare product name the caller already has, no category) and top up with
 * any new, not-already-seen URLs — strictly additive, never replaces a
 * result the precise query already found.
 */
export async function searchProductImages(
  query: string,
  max = 4,
  broaderQuery?: string
): Promise<string[]> {
  const primary = await runSearch(query, max);
  if (primary.length >= max || !broaderQuery || broaderQuery === query) {
    return primary;
  }

  const extra = await runSearch(broaderQuery, max);
  const merged = [...primary];
  for (const url of extra) {
    if (merged.length >= max) break;
    if (!merged.includes(url)) merged.push(url);
  }
  if (merged.length < max) {
    console.error(
      `[imageSearch] only ${merged.length}/${max} photo(s) found even after broadening "${query}" -> "${broaderQuery}".`
    );
  }
  return merged;
}
