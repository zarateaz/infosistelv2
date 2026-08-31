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
 */
const DDG_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
  accept: "application/json, text/javascript, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
  referer: "https://duckduckgo.com/",
};

export async function searchProductImages(query: string, max = 4): Promise<string[]> {
  const fullQuery = `${query} isolated white background product`;
  try {
    // Step 1: DuckDuckGo's HTML search page embeds a short-lived "vqd"
    // token in an inline script — the image endpoint rejects requests
    // without a valid one.
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}`, {
      headers: DDG_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!tokenRes.ok) return [];
    const html = await tokenRes.text();
    const token = html.match(/vqd=([\d-]+)&/)?.[1];
    if (!token) return [];

    // Step 2: the actual image search, moderate filter on (p=1).
    const imagesUrl =
      `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(fullQuery)}` +
      `&vqd=${token}&f=,,,&p=1`;
    const imagesRes = await fetch(imagesUrl, {
      headers: DDG_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!imagesRes.ok) return [];

    const data = await imagesRes.json();
    if (!Array.isArray(data?.results)) return [];

    return data.results
      .slice(0, max)
      .map((r: { image?: string }) => r.image)
      .filter(
        (url: unknown): url is string => typeof url === "string" && url.startsWith("https://")
      );
  } catch {
    return [];
  }
}
