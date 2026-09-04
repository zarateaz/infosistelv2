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
 * CONFIRMED IN PRODUCTION (2026-09-04): the image endpoint (i.js) 403'd
 * from the VPS's IP even though the token page (step 1) succeeded — but
 * passed once the session cookie DuckDuckGo sets on step 1 was forwarded
 * to step 2, along with a couple of Sec-Fetch-* headers. A plain
 * `fetch()` never carries cookies between two separate calls on its own,
 * so this needs to be done by hand.
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

export async function searchProductImages(query: string, max = 4): Promise<string[]> {
  const fullQuery = `${query} isolated white background product`;
  try {
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
      return [];
    }
    const html = await tokenRes.text();
    const token = html.match(/vqd=([\d-]+)&/)?.[1];
    if (!token) {
      console.error(
        `[imageSearch] could not extract "vqd" token from DuckDuckGo's page for query "${fullQuery}" — they likely changed their markup, the scraping regex needs updating.`
      );
      return [];
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
      return [];
    }

    const data = await imagesRes.json();
    if (!Array.isArray(data?.results)) {
      console.error(`[imageSearch] unexpected response shape for query "${fullQuery}":`, JSON.stringify(data).slice(0, 300));
      return [];
    }

    const urls = data.results
      .slice(0, max)
      .map((r: { image?: string }) => r.image)
      .filter((url: unknown): url is string => typeof url === "string" && url.startsWith("https://"));

    if (urls.length === 0) {
      console.error(`[imageSearch] DuckDuckGo returned ${data.results.length} result(s) but none had a usable https image URL for query "${fullQuery}".`);
    }
    return urls;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[imageSearch] request threw for query "${fullQuery}": ${reason}`);
    return [];
  }
}
