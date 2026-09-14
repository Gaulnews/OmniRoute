import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

function extractUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  return urls;
}

function extractLastmod(xml: string): string[] {
  const dates: string[] = [];
  const regex = /<lastmod>\s*(.*?)\s*<\/lastmod>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) dates.push(match[1]);
  }
  return dates;
}

function detectSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

export const seoSitemapSkill: SkillHandler = async (input, context) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  const sitemapUrl = url.replace(/\/+$/, "") + "/sitemap.xml";

  const response = await safeOutboundFetch(sitemapUrl, {
    method: "GET",
    timeoutMs: 15_000,
    guard: "public-only",
  });

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}: sitemap.xml not found`,
      url: sitemapUrl,
      context: context.apiKeyId,
    };
  }

  const xml = await response.text();
  const isSitemapIndex = detectSitemapIndex(xml);
  const urls = extractUrls(xml);
  const lastmods = extractLastmod(xml);
  const hasLastmod = lastmods.length > 0;

  const issues: string[] = [];
  if (urls.length === 0) issues.push("Sitemap contains no URLs");
  if (urls.length > 50_000) issues.push("Sitemap exceeds 50,000 URL limit");
  if (!hasLastmod) issues.push("No <lastmod> dates found");

  const uniqueUrls = new Set(urls);
  if (uniqueUrls.size < urls.length) {
    issues.push(`${urls.length - uniqueUrls.size} duplicate URLs found`);
  }

  return {
    success: true,
    url: sitemapUrl,
    isSitemapIndex,
    totalUrls: urls.length,
    uniqueUrls: uniqueUrls.size,
    hasLastmod,
    lastmodCount: lastmods.length,
    sampleUrls: urls.slice(0, 10),
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoSitemapSkill(executor: any): void {
  executor.registerHandler("seo_sitemap", seoSitemapSkill);
}
