import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function extractMetaDescription(html: string): string {
  const match = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  return match?.[1] || "";
}

function extractHeadingCount(html: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) {
    const tag = `h${i}`;
    const regex = new RegExp(`<${tag}[\\s>]`, "gi");
    counts[tag] = (html.match(regex) || []).length;
  }
  return counts;
}

function extractWordCount(html: string): number {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch?.[1] || html;
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function extractLinkCounts(html: string, baseUrl: string): { internal: number; external: number } {
  let baseDomain: string;
  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch {
    baseDomain = "";
  }

  const regex = /<a\s[^>]*href=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  let internal = 0;
  let external = 0;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1] || "";
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.hostname === baseDomain) internal++;
      else external++;
    } catch {
      if (href.startsWith("http")) external++;
      else internal++;
    }
  }
  return { internal, external };
}

function hasStructuredData(html: string): boolean {
  return /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html);
}

function hasOpenGraph(html: string): boolean {
  return /<meta[^>]*property=["']og:/i.test(html);
}

interface PageProfile {
  url: string;
  title: string;
  metaDescription: string;
  wordCount: number;
  headings: Record<string, number>;
  links: { internal: number; external: number };
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  htmlSizeBytes: number;
}

async function fetchPageProfile(url: string): Promise<PageProfile | { url: string; error: string }> {
  try {
    const response = await safeOutboundFetch(url, {
      method: "GET",
      timeoutMs: 15_000,
      guard: "public-only",
    });

    if (!response.ok) {
      return { url, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    return {
      url,
      title: extractTitle(html),
      metaDescription: extractMetaDescription(html).slice(0, 200),
      wordCount: extractWordCount(html),
      headings: extractHeadingCount(html),
      links: extractLinkCounts(html, url),
      hasStructuredData: hasStructuredData(html),
      hasOpenGraph: hasOpenGraph(html),
      htmlSizeBytes: Buffer.byteLength(html, "utf8"),
    };
  } catch (err) {
    return { url, error: (err as Error).message };
  }
}

export const seoCompetitorSkill: SkillHandler = async (input, context) => {
  const { url, competitors } = input as { url: string; competitors?: string[] };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  const urls = [url, ...(competitors || []).filter((c) => typeof c === "string").slice(0, 4)];

  const profiles = await Promise.all(urls.map(fetchPageProfile));

  const yourProfile = profiles[0];
  const competitorProfiles = profiles.slice(1);

  const insights: string[] = [];
  if ("wordCount" in yourProfile && typeof yourProfile.wordCount === "number") {
    const validComps = competitorProfiles.filter(
      (p): p is PageProfile => "wordCount" in p,
    );
    if (validComps.length > 0) {
      const avgCompWords =
        validComps.reduce((s, p) => s + p.wordCount, 0) / validComps.length;
      if (yourProfile.wordCount < avgCompWords * 0.7) {
        insights.push(
          `Your content (${yourProfile.wordCount} words) is significantly shorter than competitors' average (${Math.round(avgCompWords)} words)`,
        );
      }
      if (!yourProfile.hasStructuredData && validComps.some((p) => p.hasStructuredData)) {
        insights.push("Competitors use structured data (JSON-LD) but your page does not");
      }
      if (!yourProfile.hasOpenGraph && validComps.some((p) => p.hasOpenGraph)) {
        insights.push("Competitors have OpenGraph tags but your page does not");
      }
    }
  }

  return {
    success: true,
    url,
    yourPage: yourProfile,
    competitors: competitorProfiles,
    insights,
    context: context.apiKeyId,
  };
};

export function registerSeoCompetitorSkill(executor: unknown & { registerHandler: (name: string, handler: SkillHandler) => void }): void {
  executor.registerHandler("seo_competitor", seoCompetitorSkill);
}
