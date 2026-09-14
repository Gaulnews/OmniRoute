import { describe, it } from "node:test";
import assert from "node:assert/strict";

const _SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page Title</title>
  <meta name="description" content="This is a test page description that is long enough to pass checks easily.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://example.com/test">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Test OG Title">
  <meta property="og:description" content="Test OG Description">
  <meta property="og:image" content="https://example.com/image.jpg">
  <meta property="og:url" content="https://example.com/test">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Test Twitter Title">
  <meta name="twitter:description" content="Test Twitter Description">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"Test"}
  </script>
</head>
<body>
  <h1>Main Heading</h1>
  <p>This is a paragraph with enough words to test the content analysis skill properly.</p>
  <h2>Sub Heading</h2>
  <p>Another paragraph with additional content for testing purposes and analysis.</p>
  <img src="test.jpg" alt="Test image">
  <img src="noalt.jpg">
  <a href="https://example.com/internal">Internal</a>
  <a href="https://external.com">External</a>
</body>
</html>`;

describe("SEO Skills — input validation", () => {
  it("seoTechnicalSkill rejects missing url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoTechnical.js");
    await assert.rejects(() => mod.seoTechnicalSkill({}, { apiKeyId: "test" }), {
      message: "Missing required field: url",
    });
  });

  it("seoTechnicalSkill rejects invalid url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoTechnical.js");
    await assert.rejects(() => mod.seoTechnicalSkill({ url: "not-a-url" }, { apiKeyId: "test" }), {
      message: "Invalid URL format",
    });
  });

  it("seoContentSkill rejects missing url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoContent.js");
    await assert.rejects(() => mod.seoContentSkill({}, { apiKeyId: "test" }), {
      message: "Missing required field: url",
    });
  });

  it("seoContentSkill rejects invalid url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoContent.js");
    await assert.rejects(() => mod.seoContentSkill({ url: "bad" }, { apiKeyId: "test" }), {
      message: "Invalid URL format",
    });
  });

  it("seoSchemaSkill rejects missing url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoSchema.js");
    await assert.rejects(() => mod.seoSchemaSkill({}, { apiKeyId: "test" }), {
      message: "Missing required field: url",
    });
  });

  it("seoSchemaSkill rejects invalid url", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoSchema.js");
    await assert.rejects(() => mod.seoSchemaSkill({ url: "bad" }, { apiKeyId: "test" }), {
      message: "Invalid URL format",
    });
  });
});

describe("SEO Skills — registration", () => {
  it("registerSeoTechnicalSkill registers handler", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoTechnical.js");
    const registered: Record<string, unknown> = {};
    const executor = {
      registerHandler: (name: string, handler: unknown) => {
        registered[name] = handler;
      },
    };
    mod.registerSeoTechnicalSkill(executor);
    assert.ok(registered["seo_technical"]);
  });

  it("registerSeoContentSkill registers handler", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoContent.js");
    const registered: Record<string, unknown> = {};
    const executor = {
      registerHandler: (name: string, handler: unknown) => {
        registered[name] = handler;
      },
    };
    mod.registerSeoContentSkill(executor);
    assert.ok(registered["seo_content"]);
  });

  it("registerSeoSchemaSkill registers handler", async () => {
    const mod = await import("../../../src/lib/skills/builtin/seoSchema.js");
    const registered: Record<string, unknown> = {};
    const executor = {
      registerHandler: (name: string, handler: unknown) => {
        registered[name] = handler;
      },
    };
    mod.registerSeoSchemaSkill(executor);
    assert.ok(registered["seo_schema"]);
  });
});

describe("SEO Tools — MCP tool definitions", () => {
  it("exports three tools with correct scopes", async () => {
    const mod = await import("../../../open-sse/mcp-server/tools/seoTools.js");
    const tools = mod.seoTools;
    assert.ok(tools.omniroute_seo_audit);
    assert.ok(tools.omniroute_seo_content_analyze);
    assert.ok(tools.omniroute_seo_schema_validate);

    for (const tool of Object.values(tools) as { scopes: string[] }[]) {
      assert.ok(tool.scopes.includes("read:seo"));
      assert.ok(tool.scopes.includes("execute:seo"));
    }
  });
});
