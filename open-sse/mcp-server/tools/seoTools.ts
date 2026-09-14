import { z } from "zod";
import { seoTechnicalSkill } from "@/lib/skills/builtin/seoTechnical";
import { seoContentSkill } from "@/lib/skills/builtin/seoContent";
import { seoSchemaSkill } from "@/lib/skills/builtin/seoSchema";
import { seoSitemapSkill } from "@/lib/skills/builtin/seoSitemap";
import { seoRobotsSkill } from "@/lib/skills/builtin/seoRobots";
import { seoPerformanceSkill } from "@/lib/skills/builtin/seoPerformance";
import { seoBacklinksSkill } from "@/lib/skills/builtin/seoBacklinks";

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

  omniroute_seo_sitemap: {
    name: "omniroute_seo_sitemap",
    description:
      "Validate a site's sitemap.xml. Checks URL count, duplicates, lastmod dates, " +
      "sitemap index detection, and compliance with the 50,000 URL limit.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoSitemapSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },

  omniroute_seo_robots: {
    name: "omniroute_seo_robots",
    description:
      "Analyze a site's robots.txt. Parses user-agent directives, allow/disallow rules, " +
      "crawl-delay, and sitemap references.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoRobotsSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },

  omniroute_seo_performance: {
    name: "omniroute_seo_performance",
    description:
      "Analyze page performance indicators. Checks HTML size, resource counts, " +
      "render-blocking scripts, lazy loading, preloads, and viewport configuration.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoPerformanceSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },

  omniroute_seo_backlinks: {
    name: "omniroute_seo_backlinks",
    description:
      "Analyze the link profile of a page. Counts internal/external links, nofollow/sponsored/ugc " +
      "attributes, unique external domains, and anchor text distribution.",
    scopes: ["read:seo", "execute:seo"],
    inputSchema: SeoUrlSchema,
    handler: async (args: z.infer<typeof SeoUrlSchema>) => {
      return seoBacklinksSkill({ url: args.url }, { apiKeyId: args.apiKeyId || "anonymous" });
    },
  },
};
