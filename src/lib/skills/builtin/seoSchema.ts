import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface SchemaValidationResult {
  url: string;
  jsonLd: { valid: boolean; schemas: Record<string, unknown>[]; errors: string[] };
  openGraph: { present: boolean; tags: Record<string, string>; missing: string[] };
  twitterCards: { present: boolean; tags: Record<string, string>; missing: string[] };
  issues: string[];
}

function extractJsonLd(html: string): { schemas: Record<string, unknown>[]; errors: string[] } {
  const schemas: Record<string, unknown>[] = [];
  const errors: string[] = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) schemas.push(item as Record<string, unknown>);
      } else {
        schemas.push(parsed as Record<string, unknown>);
      }
    } catch (e) {
      errors.push(`Invalid JSON-LD: ${(e as Error).message}`);
    }
  }
  return { schemas, errors };
}

function extractMetaTags(html: string, prefix: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*?)(?:property|name)=["'](${prefix}[^"']*)["'][^>]*content=["']([^"']*)["']` +
      `|<meta\\s+(?:[^>]*?)content=["']([^"']*)["'][^>]*(?:property|name)=["'](${prefix}[^"']*)["']`,
    "gi"
  );
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[1] || match[4];
    const content = match[2] || match[3];
    if (name && content) tags[name] = content;
  }
  return tags;
}

export const seoSchemaSkill: SkillHandler = async (input) => {
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
  const issues: string[] = [];

  const jsonLdResult = extractJsonLd(html);
  const jsonLdValid = jsonLdResult.errors.length === 0 && jsonLdResult.schemas.length > 0;
  if (jsonLdResult.schemas.length === 0) issues.push("No JSON-LD structured data found");
  issues.push(...jsonLdResult.errors);

  for (const schema of jsonLdResult.schemas) {
    if (!schema["@type"]) issues.push("JSON-LD schema missing @type");
    if (!schema["@context"]) issues.push("JSON-LD schema missing @context");
  }

  const ogTags = extractMetaTags(html, "og:");
  const ogRequired = ["og:title", "og:description", "og:image", "og:url", "og:type"];
  const ogMissing = ogRequired.filter((tag) => !ogTags[tag]);
  if (ogMissing.length > 0) {
    issues.push(`Missing OpenGraph tags: ${ogMissing.join(", ")}`);
  }

  const twitterTags = extractMetaTags(html, "twitter:");
  const twitterRequired = ["twitter:card", "twitter:title", "twitter:description"];
  const twitterMissing = twitterRequired.filter((tag) => !twitterTags[tag]);
  if (twitterMissing.length > 0) {
    issues.push(`Missing Twitter Card tags: ${twitterMissing.join(", ")}`);
  }

  const result: SchemaValidationResult = {
    url,
    jsonLd: {
      valid: jsonLdValid,
      schemas: jsonLdResult.schemas,
      errors: jsonLdResult.errors,
    },
    openGraph: {
      present: Object.keys(ogTags).length > 0,
      tags: ogTags,
      missing: ogMissing,
    },
    twitterCards: {
      present: Object.keys(twitterTags).length > 0,
      tags: twitterTags,
      missing: twitterMissing,
    },
    issues,
  };

  return { success: true, analysis: result };
};

export function registerSeoSchemaSkill(
  executor: Record<string, unknown> & {
    registerHandler: (name: string, handler: SkillHandler) => void;
  }
): void {
  executor.registerHandler("seo_schema", seoSchemaSkill);
}
