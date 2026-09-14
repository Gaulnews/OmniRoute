import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface A11yIssue {
  type: string;
  severity: "error" | "warning";
  description: string;
  count: number;
}

function checkImagesAlt(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const allImages = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = allImages.filter(
    (img) => !/\balt\s*=/i.test(img),
  ).length;
  const emptyAlt = allImages.filter(
    (img) => /\balt\s*=\s*["']\s*["']/i.test(img),
  ).length;

  if (missingAlt > 0) {
    issues.push({
      type: "img-missing-alt",
      severity: "error",
      description: "Images without alt attribute",
      count: missingAlt,
    });
  }
  if (emptyAlt > 0) {
    issues.push({
      type: "img-empty-alt",
      severity: "warning",
      description: "Images with empty alt attribute (decorative?)",
      count: emptyAlt,
    });
  }
  return issues;
}

function checkFormLabels(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputs.filter((inp) => {
    if (/type=["'](?:hidden|submit|button|reset|image)["']/i.test(inp)) return false;
    const idMatch = inp.match(/\bid=["']([^"']*)["']/i);
    if (!idMatch?.[1]) return true;
    const labelFor = new RegExp(
      `<label[^>]*\\bfor=["']${idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "i",
    );
    return !labelFor.test(html);
  }).length;

  if (inputsWithoutLabel > 0) {
    issues.push({
      type: "input-missing-label",
      severity: "error",
      description: "Form inputs without associated label",
      count: inputsWithoutLabel,
    });
  }
  return issues;
}

function checkHeadingHierarchy(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const levels: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    levels.push(parseInt(match[1], 10));
  }

  if (levels.length > 0 && levels[0] !== 1) {
    issues.push({
      type: "heading-no-h1-first",
      severity: "warning",
      description: "First heading is not h1",
      count: 1,
    });
  }

  const h1Count = levels.filter((l) => l === 1).length;
  if (h1Count > 1) {
    issues.push({
      type: "heading-multiple-h1",
      severity: "warning",
      description: "Multiple h1 elements found",
      count: h1Count,
    });
  }

  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      issues.push({
        type: "heading-skip-level",
        severity: "warning",
        description: `Heading level skipped (h${levels[i - 1]} → h${levels[i]})`,
        count: 1,
      });
      break;
    }
  }

  return issues;
}

function checkLangAttribute(html: string): A11yIssue[] {
  if (!/<html[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) {
    return [
      {
        type: "html-missing-lang",
        severity: "error",
        description: "Missing lang attribute on <html> element",
        count: 1,
      },
    ];
  }
  return [];
}

function checkAriaLandmarks(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const hasMain =
    /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  const hasNav =
    /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html);

  if (!hasMain) {
    issues.push({
      type: "missing-main-landmark",
      severity: "warning",
      description: "No <main> landmark found",
      count: 1,
    });
  }
  if (!hasNav) {
    issues.push({
      type: "missing-nav-landmark",
      severity: "warning",
      description: "No <nav> landmark found",
      count: 1,
    });
  }
  return issues;
}

function checkColorContrast(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const lowContrastPatterns = [
    /color:\s*#(?:ccc|ddd|eee|fff)\b/gi,
    /color:\s*(?:lightgr[ae]y|silver)\b/gi,
  ];

  let suspectCount = 0;
  for (const pattern of lowContrastPatterns) {
    const matches = html.match(pattern);
    if (matches) suspectCount += matches.length;
  }

  if (suspectCount > 0) {
    issues.push({
      type: "potential-low-contrast",
      severity: "warning",
      description: "Potential low-contrast text colors detected in inline styles",
      count: suspectCount,
    });
  }
  return issues;
}

function checkLinksAccessibility(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const links = html.match(/<a\s[^>]*>[\s\S]*?<\/a>/gi) || [];
  let genericCount = 0;

  for (const link of links) {
    const text = link
      .replace(/<[^>]*>/g, "")
      .trim()
      .toLowerCase();
    if (
      text === "click here" ||
      text === "here" ||
      text === "read more" ||
      text === "more" ||
      text === "link"
    ) {
      genericCount++;
    }
  }

  if (genericCount > 0) {
    issues.push({
      type: "generic-link-text",
      severity: "warning",
      description: 'Links with generic text ("click here", "read more", etc.)',
      count: genericCount,
    });
  }

  return issues;
}

export const seoAccessibilitySkill: SkillHandler = async (input, context) => {
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

  const allIssues: A11yIssue[] = [
    ...checkLangAttribute(html),
    ...checkImagesAlt(html),
    ...checkHeadingHierarchy(html),
    ...checkFormLabels(html),
    ...checkAriaLandmarks(html),
    ...checkColorContrast(html),
    ...checkLinksAccessibility(html),
  ];

  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return {
    success: true,
    url,
    totalIssues: allIssues.length,
    errors: errors.length,
    warnings: warnings.length,
    issues: allIssues,
    score: Math.max(0, 100 - errors.length * 15 - warnings.length * 5),
    context: context.apiKeyId,
  };
};

export function registerSeoAccessibilitySkill(executor: unknown & { registerHandler: (name: string, handler: SkillHandler) => void }): void {
  executor.registerHandler("seo_accessibility", seoAccessibilitySkill);
}
