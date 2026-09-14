import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface RobotsDirective {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

function parseRobotsTxt(text: string): {
  directives: RobotsDirective[];
  sitemaps: string[];
  rawLineCount: number;
} {
  const lines = text.split(/\r?\n/);
  const directives: RobotsDirective[] = [];
  const sitemaps: string[] = [];
  let current: RobotsDirective | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      current = { userAgent: value, allow: [], disallow: [] };
      directives.push(current);
    } else if (current) {
      if (key === "disallow" && value) current.disallow.push(value);
      else if (key === "allow" && value) current.allow.push(value);
      else if (key === "crawl-delay") {
        const delay = Number.parseFloat(value);
        if (!Number.isNaN(delay)) current.crawlDelay = delay;
      }
    }

    if (key === "sitemap" && value) sitemaps.push(value);
  }

  return { directives, sitemaps, rawLineCount: lines.length };
}

export const seoRobotsSkill: SkillHandler = async (input, context) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  const robotsUrl = url.replace(/\/+$/, "") + "/robots.txt";

  const response = await safeOutboundFetch(robotsUrl, {
    method: "GET",
    timeoutMs: 10_000,
    guard: "public-only",
  });

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}: robots.txt not found`,
      url: robotsUrl,
      context: context.apiKeyId,
    };
  }

  const text = await response.text();
  const parsed = parseRobotsTxt(text);

  const issues: string[] = [];
  if (parsed.directives.length === 0) {
    issues.push("No user-agent directives found");
  }
  if (parsed.sitemaps.length === 0) {
    issues.push("No sitemap reference in robots.txt");
  }

  const wildcardAgent = parsed.directives.find((d) => d.userAgent === "*");
  if (!wildcardAgent) {
    issues.push("No wildcard (*) user-agent rule");
  }

  const totalDisallow = parsed.directives.reduce(
    (sum, d) => sum + d.disallow.length,
    0,
  );
  if (totalDisallow === 0) {
    issues.push("No disallow rules — entire site is crawlable");
  }

  return {
    success: true,
    url: robotsUrl,
    lineCount: parsed.rawLineCount,
    userAgents: parsed.directives.map((d) => d.userAgent),
    directives: parsed.directives,
    sitemaps: parsed.sitemaps,
    totalAllowRules: parsed.directives.reduce(
      (sum, d) => sum + d.allow.length,
      0,
    ),
    totalDisallowRules: totalDisallow,
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoRobotsSkill(executor: any): void {
  executor.registerHandler("seo_robots", seoRobotsSkill);
}
