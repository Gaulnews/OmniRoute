import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface SeoTechnicalResult {
  url: string;
  statusCode: number;
  redirectChain: string[];
  meta: {
    title: string | null;
    titleLength: number;
    description: string | null;
    descriptionLength: number;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
  };
  headings: Record<string, number>;
  security: {
    https: boolean;
    hsts: boolean;
    xFrameOptions: string | null;
    contentSecurityPolicy: boolean;
    xContentTypeOptions: string | null;
  };
  performance: {
    contentLength: number | null;
    serverTiming: string | null;
    cacheControl: string | null;
  };
  issues: string[];
}

function extractMetaContent(html: string, name: string): string | null {
  const pattern = new RegExp(
    `<meta\\s+(?:[^>]*?)?(?:name|property)=["']${name}["'][^>]*?content=["']([^"']*)["']` +
      `|<meta\\s+(?:[^>]*?)?content=["']([^"']*)["'][^>]*?(?:name|property)=["']${name}["']`,
    "i"
  );
  const match = html.match(pattern);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

function countHeadings(html: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let level = 1; level <= 6; level++) {
    const tag = `h${level}`;
    const regex = new RegExp(`<${tag}[\\s>]`, "gi");
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      counts[tag] = matches.length;
    }
  }
  return counts;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  return match ? match[1] : null;
}

export const seoTechnicalSkill: SkillHandler = async (input) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  const issues: string[] = [];
  const redirectChain: string[] = [];

  const response = await safeOutboundFetch(url, {
    method: "GET",
    timeoutMs: 15_000,
    allowRedirect: true,
    retry: false,
    guard: "public-only",
  });

  const html = await response.text();
  const title = extractTitle(html);
  const description = extractMetaContent(html, "description");
  const robots = extractMetaContent(html, "robots");
  const viewport = extractMetaContent(html, "viewport");
  const canonical = extractCanonical(html);

  if (!title) issues.push("Missing <title> tag");
  else if (title.length > 60) issues.push("Title too long (>60 chars)");
  else if (title.length < 10) issues.push("Title too short (<10 chars)");

  if (!description) issues.push("Missing meta description");
  else if (description.length > 160) issues.push("Meta description too long (>160 chars)");
  else if (description.length < 50) issues.push("Meta description too short (<50 chars)");

  if (!viewport) issues.push("Missing viewport meta tag");
  if (!canonical) issues.push("Missing canonical URL");

  const headings = countHeadings(html);
  if (!headings.h1) issues.push("Missing H1 heading");
  else if (headings.h1 > 1) issues.push("Multiple H1 headings found");

  const isHttps = parsedUrl.protocol === "https:";
  const hsts = response.headers.get("strict-transport-security");
  const xfo = response.headers.get("x-frame-options");
  const csp = response.headers.get("content-security-policy");
  const xcto = response.headers.get("x-content-type-options");

  if (!isHttps) issues.push("Not using HTTPS");
  if (!hsts) issues.push("Missing HSTS header");
  if (!xcto) issues.push("Missing X-Content-Type-Options header");

  if (robots && robots.includes("noindex")) {
    issues.push("Page is set to noindex");
  }

  const result: SeoTechnicalResult = {
    url: response.url || url,
    statusCode: response.status,
    redirectChain,
    meta: {
      title,
      titleLength: title?.length ?? 0,
      description,
      descriptionLength: description?.length ?? 0,
      canonical,
      robots,
      viewport,
    },
    headings,
    security: {
      https: isHttps,
      hsts: !!hsts,
      xFrameOptions: xfo,
      contentSecurityPolicy: !!csp,
      xContentTypeOptions: xcto,
    },
    performance: {
      contentLength: Number(response.headers.get("content-length")) || null,
      serverTiming: response.headers.get("server-timing"),
      cacheControl: response.headers.get("cache-control"),
    },
    issues,
  };

  return { success: true, analysis: result };
};

export function registerSeoTechnicalSkill(
  executor: Record<string, unknown> & {
    registerHandler: (name: string, handler: SkillHandler) => void;
  }
): void {
  executor.registerHandler("seo_technical", seoTechnicalSkill);
}
