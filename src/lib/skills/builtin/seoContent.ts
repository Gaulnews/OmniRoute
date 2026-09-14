import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface ContentAnalysis {
  url: string;
  wordCount: number;
  paragraphCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  headingStructure: { tag: string; text: string }[];
  images: { total: number; withAlt: number; withoutAlt: number };
  links: { internal: number; external: number; nofollow: number };
  readabilityScore: number;
  keywordDensity: Record<string, number>;
  issues: string[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadingStructure(html: string): { tag: string; text: string }[] {
  const headings: { tag: string; text: string }[] = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      tag: match[1].toLowerCase(),
      text: match[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return headings;
}

function analyzeImages(html: string): { total: number; withAlt: number; withoutAlt: number } {
  const imgRegex = /<img\s[^>]*>/gi;
  const images = html.match(imgRegex) || [];
  let withAlt = 0;
  for (const img of images) {
    if (/alt=["'][^"']+["']/i.test(img)) withAlt++;
  }
  return { total: images.length, withAlt, withoutAlt: images.length - withAlt };
}

function analyzeLinks(
  html: string,
  baseUrl: string
): { internal: number; external: number; nofollow: number } {
  const linkRegex = /<a\s[^>]*href=["']([^"']*)["'][^>]*>/gi;
  let internal = 0;
  let external = 0;
  let nofollow = 0;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const fullTag = match[0];
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const linkUrl = new URL(href, baseUrl);
      const base = new URL(baseUrl);
      if (linkUrl.hostname === base.hostname) internal++;
      else external++;
    } catch {
      internal++;
    }
    if (/rel=["'][^"']*nofollow[^"']*["']/i.test(fullTag)) nofollow++;
  }
  return { internal, external, nofollow };
}

function computeKeywordDensity(text: string): Record<string, number> {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const total = words.length;
  if (total === 0) return {};
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  const density: Record<string, number> = {};
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [word, count] of sorted) {
    density[word] = Math.round((count / total) * 10000) / 100;
  }
  return density;
}

function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const syllables = words.reduce((sum, word) => {
    const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
    const count = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
    return sum + Math.max(1, count?.length ?? 1);
  }, 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  return Math.round(
    206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
  );
}

export const seoContentSkill: SkillHandler = async (input) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  const response = await safeOutboundFetch(url, {
    method: "GET",
    timeoutMs: 15_000,
    allowRedirect: true,
    retry: false,
    guard: "public-only",
  });

  const html = await response.text();
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];

  const issues: string[] = [];
  if (words.length < 300) issues.push("Thin content (<300 words)");
  if (sentences.length > 0 && words.length / sentences.length > 25) {
    issues.push("Average sentence length too high (>25 words)");
  }

  const headingStructure = extractHeadingStructure(html);
  if (headingStructure.length === 0) issues.push("No headings found");

  const images = analyzeImages(html);
  if (images.withoutAlt > 0) {
    issues.push(`${images.withoutAlt} image(s) missing alt text`);
  }

  const links = analyzeLinks(html, url);
  if (links.external === 0) issues.push("No external links found");
  if (links.internal === 0) issues.push("No internal links found");

  const readabilityScore = fleschReadingEase(text);
  if (readabilityScore < 30) issues.push("Content is very difficult to read");

  const analysis: ContentAnalysis = {
    url,
    wordCount: words.length,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence:
      sentences.length > 0 ? Math.round((words.length / sentences.length) * 10) / 10 : 0,
    headingStructure,
    images,
    links,
    readabilityScore,
    keywordDensity: computeKeywordDensity(text),
    issues,
  };

  return { success: true, analysis };
};

export function registerSeoContentSkill(
  executor: Record<string, unknown> & {
    registerHandler: (name: string, handler: SkillHandler) => void;
  }
): void {
  executor.registerHandler("seo_content", seoContentSkill);
}
