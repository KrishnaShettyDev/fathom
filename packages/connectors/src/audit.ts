import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { loadBuffer } from "cheerio";
import robotsParser from "robots-parser";
import { ProviderError } from "./shopify.js";
export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function auditUrl(input: string): URL {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.href.length > 2048
  )
    throw new ProviderError("AUDIT_URL_REJECTED");
  url.hash = "";
  return url;
}
function sameSite(from: URL, to: URL): boolean {
  return (
    from.hostname === to.hostname &&
    !(from.protocol === "https:" && to.protocol === "http:")
  );
}
export async function fetchPublicPage(
  input: string,
  signal: AbortSignal,
  redirects = 0,
): Promise<{ url: string; status: number; body: Buffer; contentType: string }> {
  const url = auditUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new ProviderError("AUDIT_PRIVATE_ADDRESS");
  const pinned = addresses[0];
  if (!pinned) throw new ProviderError("AUDIT_DNS_EMPTY");
  const result = await new Promise<{
    status: number;
    body: Buffer;
    contentType: string;
    location: string | undefined;
  }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(
      url,
      {
        method: "GET",
        agent: false,
        family: pinned.family,
        lookup: (_host, _options, callback) =>
          callback(null, pinned.address, pinned.family),
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        headers: {
          "User-Agent": "FathomBot/1.0",
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          response.destroy();
          reject(new ProviderError("AUDIT_UNSUPPORTED_ENCODING"));
          return;
        }
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1_000_000) {
            response.destroy(new ProviderError("AUDIT_BODY_LIMIT"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks),
            contentType: response.headers["content-type"] ?? "",
            location: response.headers.location,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    if (redirects >= 3) throw new ProviderError("AUDIT_REDIRECT_LIMIT");
    const next = auditUrl(new URL(result.location, url).href);
    if (!sameSite(url, next))
      throw new ProviderError("AUDIT_CROSS_ORIGIN_REDIRECT");
    return fetchPublicPage(next.href, signal, redirects + 1);
  }
  return {
    url: url.href,
    status: result.status,
    body: result.body,
    contentType: result.contentType,
  };
}
export type Finding = {
  code: string;
  severity: "error" | "notice";
  explanation: string;
  evidence: string;
};
export function inspectHtml(url: string, status: number, body: Buffer) {
  const $ = loadBuffer(body);
  const findings: Finding[] = [];
  if (status >= 400)
    findings.push({
      code: "HTTP_ERROR",
      severity: "error",
      explanation:
        "The page returned an HTTP error. Verify whether this destination should be available.",
      evidence: `GET ${url} returned ${status}`,
    });
  if (status === 200) {
    if (!$("title").text().trim())
      findings.push({
        code: "MISSING_TITLE",
        severity: "notice",
        explanation:
          "No non-empty title was present in the received HTML. Client-rendered content may differ.",
        evidence: "Selector title: empty or absent",
      });
    if (!$('meta[name="description"]').attr("content")?.trim())
      findings.push({
        code: "MISSING_DESCRIPTION",
        severity: "notice",
        explanation:
          "No meta description was present. Review the page purpose before deciding whether one is needed.",
        evidence: 'Selector meta[name="description"]: content empty or absent',
      });
    if (!$("h1").text().trim())
      findings.push({
        code: "MISSING_H1",
        severity: "notice",
        explanation:
          "No non-empty H1 was present in static HTML. Inspect the rendered page and heading structure.",
        evidence: "Selector h1: empty or absent",
      });
    const robots = $('meta[name="robots"]').attr("content") ?? "";
    if (/\bnoindex\b/i.test(robots))
      findings.push({
        code: "NOINDEX",
        severity: "notice",
        explanation:
          "The page declares noindex. Confirm that this matches the intended search visibility.",
        evidence: `meta robots: ${robots.slice(0, 500)}`,
      });
  }
  const root = auditUrl(url);
  const links = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const next = auditUrl(new URL(href, root).href);
      if (sameSite(root, next) && !next.search && links.size < 100)
        links.add(next.href);
    } catch {
      /* Non-HTTP or malformed links are outside this audit's crawl scope. */
    }
  });
  return {
    findings,
    links: [...links],
    title: $("title").text().slice(0, 500),
  };
}
export async function robotsPolicy(target: string, signal: AbortSignal) {
  const root = auditUrl(target);
  const url = new URL("/robots.txt", root).href;
  const result = await fetchPublicPage(url, signal);
  if (result.status !== 200 && result.status !== 404)
    throw new ProviderError("AUDIT_ROBOTS_UNAVAILABLE");
  const robots = robotsParser(
    result.url,
    result.status === 404 ? "" : result.body.toString("utf8"),
  );
  const wait = robots.getCrawlDelay("FathomBot") ?? 1;
  if (wait > 10) throw new ProviderError("AUDIT_CRAWL_DELAY_UNSUPPORTED");
  return {
    allowed: (url: string) => robots.isAllowed(url, "FathomBot") !== false,
    delayMs: Math.max(wait, 1) * 1000,
  };
}
