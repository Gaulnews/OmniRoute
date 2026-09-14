import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

function extractMetaViewport(html: string): string | null {
  const match = html.match(
    /<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  return match?.[1] ?? null;
}

function countResources(html: string) {
  const scripts = (html.match(/<script[\s>]/gi) || []).length;
  const stylesheets = (
    html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []
  ).length;
  const inlineStyles = (html.match(/<style[\s>]/gi) || []).length;
  const images = (html.match(/<img[\s>]/gi) || []).length;
  const iframes = (html.match(/<iframe[\s>]/gi) || []).length;
  return { scripts, stylesheets, inlineStyles, images, iframes };
}

function checkLazyLoading(html: string): {
  lazyImages: number;
  eagerImages: number;
} {
  const lazyImages = (
    html.match(/<img[^>]*loading=["']lazy["'][^>]*>/gi) || []
  ).length;
  const totalImages = (html.match(/<img[\s>]/gi) || []).length;
  return { lazyImages, eagerImages: totalImages - lazyImages };
}

function checkPreloads(html: string): string[] {
  const preloads: string[] = [];
  const regex = /<link[^>]*rel=["']preload["'][^>]*href=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) preloads.push(match[1]);
  }
  return preloads;
}

function checkRenderBlocking(html: string): {
  blockingScripts: number;
  asyncScripts: number;
  deferScripts: number;
} {
  const allScripts = html.match(/<script[^>]*src=["'][^"']*["'][^>]*>/gi) || [];
  let asyncScripts = 0;
  let deferScripts = 0;

  for (const tag of allScripts) {
    if (/\basync\b/i.test(tag)) asyncScripts++;
    if (/\bdefer\b/i.test(tag)) deferScripts++;
  }

  return {
    blockingScripts: allScripts.length - asyncScripts - deferScripts,
    asyncScripts,
    deferScripts,
  };
}

export const seoPerformanceSkill: SkillHandler = async (input, context) => {
  const { url } = input as { url: string };
  if (!url || typeof url !== "string") {
    throw new Error("Missing required field: url");
  }

  const startTime = Date.now();

  const response = await safeOutboundFetch(url, {
    method: "GET",
    timeoutMs: 20_000,
    guard: "public-only",
  });

  const loadTimeMs = Date.now() - startTime;

  if (!response.ok) {
    return {
      success: false,
      error: `HTTP ${response.status}`,
      url,
      context: context.apiKeyId,
    };
  }

  const html = await response.text();
  const htmlSizeBytes = Buffer.byteLength(html, "utf8");
  const viewport = extractMetaViewport(html);
  const resources = countResources(html);
  const lazyLoading = checkLazyLoading(html);
  const preloads = checkPreloads(html);
  const renderBlocking = checkRenderBlocking(html);

  const issues: string[] = [];
  if (!viewport) issues.push("Missing viewport meta tag");
  if (htmlSizeBytes > 100_000) issues.push("HTML exceeds 100KB");
  if (resources.scripts > 15) issues.push("More than 15 script tags");
  if (resources.stylesheets > 5) issues.push("More than 5 external stylesheets");
  if (renderBlocking.blockingScripts > 3) {
    issues.push(`${renderBlocking.blockingScripts} render-blocking scripts`);
  }
  if (lazyLoading.eagerImages > 10) {
    issues.push(`${lazyLoading.eagerImages} images without lazy loading`);
  }

  return {
    success: true,
    url,
    loadTimeMs,
    htmlSizeBytes,
    viewport,
    resources,
    lazyLoading,
    preloads,
    renderBlocking,
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoPerformanceSkill(executor: any): void {
  executor.registerHandler("seo_performance", seoPerformanceSkill);
}
