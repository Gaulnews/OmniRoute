import { z } from "zod";
import { seoTechnicalSkill } from "@/lib/skills/builtin/seoTechnical";
import { seoContentSkill } from "@/lib/skills/builtin/seoContent";
import { seoSchemaSkill } from "@/lib/skills/builtin/seoSchema";

const SeoUrlSchema = z.object({
  url: z.string().url(),
  apiKeyId: z.string().optional(),
});

export const seoTools = {
  omniroute_seo_audit: {
    name: "omniroute_seo_audit",
    description:
      "Run a technical SEO audit on a URL. Checks meta tags, headings, security headers, " +
      "HTTPS, canonical URLs, and identifies common technical SEO issues.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoTechnicalSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },

  omniroute_seo_content_analyze: {
    name: "omniroute_seo_content_analyze",
    description:
      "Analyze content quality of a URL. Checks word count, readability, heading structure, " +
      "image alt text, link profile, and keyword density.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoContentSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },

  omniroute_seo_schema_validate: {
    name: "omniroute_seo_schema_validate",
    description:
      "Validate structured data (JSON-LD, OpenGraph, Twitter Cards) on a URL. " +
      "Checks for required tags, valid JSON-LD schemas, and social sharing metadata.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoSchemaSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },
};
