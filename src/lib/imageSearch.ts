/**
 * Image search against DuckDuckGo's own (undocumented, public) image
 * endpoint via plain `fetch` — no `duckduckgo-images-api` package, which
 * pulled in an unmaintained axios/follow-redirects chain with 3 high
 * CVEs (SSRF, prototype pollution) for what is, underneath, two HTTP GETs.
 * Same protocol, zero extra dependencies. See hardening-log.md #25.
 *
 * Shared by both product-photo flows: the barcode scanner's fallback when
 * a listing has no photo (scan-actions.ts), and the Alta Rápida quick-add
 * scanner (api/scanner/route.ts).
 *
 * This is scraping an undocumented endpoint — DuckDuckGo can change the
 * page markup or start blocking a server's IP/reputation at any time, with
 * no warning. Every failure path below is logged (never silent) so a break
 * shows up in `pm2 logs` instead of just quietly returning zero photos
 * forever with no way to tell "no results" from "broken".
 *
 * CONFIRMED IN PRODUCTION (2026-09-04):
 * 1. The image endpoint (i.js) 403'd from the VPS's IP even though the
 *    token page (step 1) succeeded — fixed by forwarding the session
 *    cookie DuckDuckGo sets on step 1 to step 2 (a plain fetch() never
 *    carries cookies between two separate calls on its own).
 * 2. After that fix, a handful of searches in a row still went back to
 *    403 — DuckDuckGo throttling by request *rate*, not just IP: the
 *    admin adding several products back-to-back (the normal workflow)
 *    was enough to trip it. Mitigated with a minimum gap enforced
 *    between calls (throttle()) plus one retry on a fresh token/cookie
 *    if a burst still gets rejected. This raises the odds noticeably but
 *    is NOT a guarantee — DuckDuckGo can still hard-block the IP outright,
 *    at which point no amount of pacing fixes it and the real fix is a
 *    paid, official search API instead of scraping.
 */
const BASE_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "accept-language": "es-PE,es;q=0.9,en;q=0.8",
};

/** DuckDuckGo's Set-Cookie values are full `name=value; Domain=...; Path=...`
 *  attribute strings — a request Cookie header only wants the `name=value`
 *  part of each, joined with "; ". */
function cookieHeaderFrom(setCookieValues: string[]): string {
  return setCookieValues.map((raw) => raw.split(";")[0]).join("; ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Module-level (per Node process — this app runs a single PM2 fork
// instance) minimum gap enforced between DuckDuckGo calls, regardless of
// how many admins/tabs trigger a search at once. A few seconds of jitter
// on top so consecutive requests don't land at an exact, bot-like cadence.
const MIN_GAP_MS = 4000;
let nextCallAt = 0;

async function throttle(): Promise<void> {
  const wait = nextCallAt - Date.now();
  nextCallAt = Math.max(nextCallAt, Date.now()) + MIN_GAP_MS + Math.floor(Math.random() * 1500);
  if (wait > 0) await sleep(wait);
}

interface Attempt {
  ok: boolean;
  urls: string[];
  /** True only for a 403 on step 2 specifically — the one failure mode a
   *  fresh-session retry has any real chance of recovering from. */
  retryable: boolean;
}

async function attempt(fullQuery: string, max: number): Promise<Attempt> {
  // Step 1: DuckDuckGo's HTML search page embeds a short-lived "vqd"
  // token in an inline script — the image endpoint rejects requests
  // without a valid one. It also sets a session cookie that step 2
  // requires (see the file header comment) — captured via
  // getSetCookie(), available on Node's built-in fetch since Node 18.14.
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}`, {
    headers: {
      ...BASE_HEADERS,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!tokenRes.ok) {
    console.error(
      `[imageSearch] token request failed: HTTP ${tokenRes.status} for query "${fullQuery}" — DuckDuckGo may be blocking this server's IP.`
    );
    return { ok: false, urls: [], retryable: false };
  }
  const html = await tokenRes.text();
  const token = html.match(/vqd=([\d-]+)&/)?.[1];
  if (!token) {
    console.error(
      `[imageSearch] could not extract "vqd" token from DuckDuckGo's page for query "${fullQuery}" — they likely changed their markup, the scraping regex needs updating.`
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
      ...BASE_HEADERS,
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
    console.error(`[imageSearch] image request failed: HTTP ${imagesRes.status} for query "${fullQuery}".`);
    return { ok: false, urls: [], retryable: imagesRes.status === 403 };
  }

  const data = await imagesRes.json();
  if (!Array.isArray(data?.results)) {
    console.error(`[imageSearch] unexpected response shape for query "${fullQuery}":`, JSON.stringify(data).slice(0, 300));
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

export async function searchProductImages(query: string, max = 4): Promise<string[]> {
  const fullQuery = `${query} isolated white background product`;
  try {
    await throttle();
    const first = await attempt(fullQuery, max);
    if (first.ok || !first.retryable) return first.urls;

    // A 403 specifically on step 2 can mean "this particular session got
    // flagged" rather than "this IP is fully blocked" — one retry on a
    // brand-new token/cookie is cheap and occasionally recovers it. If
    // this also 403s, it really is the IP/rate limit and no amount of
    // retrying will fix it.
    console.error(`[imageSearch] retrying once with a fresh session for query "${fullQuery}".`);
    await sleep(2000 + Math.floor(Math.random() * 1000));
    const second = await attempt(fullQuery, max);
    return second.urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] request threw for query "${fullQuery}": ${reason}`);
    return [];
  }
}
