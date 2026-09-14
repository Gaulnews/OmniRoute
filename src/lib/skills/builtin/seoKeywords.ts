import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

function extractTextContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch?.[1] || html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = (match[1] || "").replace(/<[^>]*>/g, "").trim();
    if (text) headings.push(text);
  }
  return headings;
}

function computeNGrams(words: string[], n: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(" ");
    counts[gram] = (counts[gram] || 0) + 1;
  }
  return counts;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "this", "that", "not", "no", "do", "has", "have", "had", "will",
  "can", "could", "would", "should", "may", "might", "shall", "been",
  "being", "if", "so", "than", "then", "also", "just", "about", "into",
  "over", "after", "before", "between", "through", "during", "without",
  "again", "further", "once", "here", "there", "when", "where", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "only", "own", "same", "too", "very", "its", "our", "your",
  "his", "her", "their", "my", "me", "him", "them", "we", "you", "he",
  "she", "they", "what", "which", "who", "whom", "up", "out",
]);

export const seoKeywordsSkill: SkillHandler = async (input, context) => {
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
  const text = extractTextContent(html);
  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const headings = extractHeadings(html);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const unigrams = computeNGrams(words, 1);
  const bigrams = computeNGrams(words, 2);
  const trigrams = computeNGrams(words, 3);

  const topUnigrams = Object.entries(unigrams)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word, count]) => ({
      keyword: word,
      count,
      density: Number(((count / words.length) * 100).toFixed(2)),
    }));

  const topBigrams = Object.entries(bigrams)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([phrase, count]) => ({ phrase, count }));

  const topTrigrams = Object.entries(trigrams)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const headingWords = headings
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const prominentKeywords = new Set([...titleWords, ...headingWords]);
  const keywordsInTitleAndContent = topUnigrams
    .filter((u) => prominentKeywords.has(u.keyword))
    .map((u) => u.keyword);

  const issues: string[] = [];
  if (words.length < 100) {
    issues.push("Very thin content (fewer than 100 meaningful words)");
  }
  if (titleWords.length === 0) {
    issues.push("No keywords found in page title");
  }
  if (topUnigrams.length > 0 && topUnigrams[0].density > 5) {
    issues.push(
      `Potential keyword stuffing: "${topUnigrams[0].keyword}" density ${topUnigrams[0].density}%`,
    );
  }

  return {
    success: true,
    url,
    totalWords: words.length,
    title,
    metaDescription: metaDescription.slice(0, 200),
    topKeywords: topUnigrams,
    topPhrases: topBigrams,
    topTrigrams,
    keywordsInTitleAndContent,
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoKeywordsSkill(executor: unknown & { registerHandler: (name: string, handler: SkillHandler) => void }): void {
  executor.registerHandler("seo_keywords", seoKeywordsSkill);
}
