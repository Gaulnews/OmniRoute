import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface LinkInfo {
  href: string;
  text: string;
  rel: string;
  isExternal: boolean;
}

function extractLinks(html: string, baseUrl: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const regex = /<a\s([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let baseDomain: string;

  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch {
    baseDomain = "";
  }

  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1] || "";
    const text = (match[2] || "").replace(/<[^>]*>/g, "").trim();

    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    const relMatch = attrs.match(/rel=["']([^"']*)["']/i);

    if (!hrefMatch?.[1]) continue;

    const href = hrefMatch[1];
    const rel = relMatch?.[1] || "";
    let isExternal = false;

    try {
      const linkUrl = new URL(href, baseUrl);
      isExternal = linkUrl.hostname !== baseDomain;
    } catch {
      isExternal = href.startsWith("http");
    }

    links.push({ href, text: text.slice(0, 100), rel, isExternal });
  }

  return links;
}

function analyzeAnchorText(links: LinkInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const link of links) {
    const normalized = link.text.toLowerCase().trim();
    if (!normalized || normalized.length < 2) continue;
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20),
  );
}

export const seoBacklinksSkill: SkillHandler = async (input, context) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  const response = await safeOutboundFetch(url, {
    method: "GET",
    timeoutMs: 15_000,
    guard: "public-only",
  });

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}`,
      url,
      context: context.apiKeyId,
    };
  }

  const html = await response.text();
  const allLinks = extractLinks(html, url);

  const internalLinks = allLinks.filter((l) => !l.isExternal);
  const externalLinks = allLinks.filter((l) => l.isExternal);
  const nofollowLinks = allLinks.filter((l) =>
    l.rel.toLowerCase().includes("nofollow"),
  );
  const sponsoredLinks = allLinks.filter((l) =>
    l.rel.toLowerCase().includes("sponsored"),
  );
  const ugcLinks = allLinks.filter((l) =>
    l.rel.toLowerCase().includes("ugc"),
  );

  const externalDomains = new Set<string>();
  for (const link of externalLinks) {
    try {
      externalDomains.add(new URL(link.href, url).hostname);
    } catch {
      // skip malformed URLs
    }
  }

  const anchorTextDistribution = analyzeAnchorText(externalLinks);

  const issues: string[] = [];
  if (externalLinks.length === 0) {
    issues.push("No external links found on the page");
  }
  if (internalLinks.length < 3) {
    issues.push("Very few internal links (less than 3)");
  }

  const emptyAnchorLinks = allLinks.filter((l) => !l.text.trim()).length;
  if (emptyAnchorLinks > 0) {
    issues.push(`${emptyAnchorLinks} links with empty anchor text`);
  }

  return {
    success: true,
    url,
    totalLinks: allLinks.length,
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    nofollowLinks: nofollowLinks.length,
    sponsoredLinks: sponsoredLinks.length,
    ugcLinks: ugcLinks.length,
    uniqueExternalDomains: externalDomains.size,
    topExternalDomains: [...externalDomains].slice(0, 20),
    anchorTextDistribution,
    emptyAnchorLinks,
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoBacklinksSkill(executor: any): void {
  executor.registerHandler("seo_backlinks", seoBacklinksSkill);
}
