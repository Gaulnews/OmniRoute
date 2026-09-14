import { SkillHandler } from "../types";
import { safeOutboundFetch } from "@/shared/network/safeOutboundFetch";

interface LocalSeoData {
  hasLocalBusinessSchema: boolean;
  localBusinessType: string | null;
  name: string | null;
  address: string | null;
  phone: string | null;
  geo: { lat: string; lng: string } | null;
  openingHours: string | null;
  hasGoogleMapsEmbed: boolean;
  hasNapConsistency: boolean;
  napDetails: { name: string | null; address: string | null; phone: string | null };
}

function extractJsonLdLocalBusiness(html: string): Partial<LocalSeoData> {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = item["@type"] || "";
        if (
          typeof type === "string" &&
          (type.includes("LocalBusiness") ||
            type.includes("Restaurant") ||
            type.includes("Store") ||
            type.includes("MedicalBusiness") ||
            type.includes("LegalService") ||
            type.includes("FinancialService") ||
            type.includes("ProfessionalService"))
        ) {
          const address = item.address || {};
          const geo = item.geo || {};
          return {
            hasLocalBusinessSchema: true,
            localBusinessType: type,
            name: item.name || null,
            address: address.streetAddress
              ? `${address.streetAddress}, ${address.addressLocality || ""}, ${address.addressRegion || ""} ${address.postalCode || ""}`
              : null,
            phone: item.telephone || null,
            geo:
              geo.latitude && geo.longitude
                ? { lat: String(geo.latitude), lng: String(geo.longitude) }
                : null,
            openingHours: item.openingHours
              ? Array.isArray(item.openingHours)
                ? item.openingHours.join(", ")
                : String(item.openingHours)
              : null,
          };
        }
      }
    } catch {
      // skip malformed JSON-LD
    }
  }
  return { hasLocalBusinessSchema: false };
}

function extractPhoneNumbers(html: string): string[] {
  const phones: string[] = [];
  const telRegex = /href=["']tel:([^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = telRegex.exec(html)) !== null) {
    if (match[1]) phones.push(match[1].trim());
  }
  return [...new Set(phones)];
}

function hasGoogleMapsEmbed(html: string): boolean {
  return /google\.com\/maps/i.test(html) || /maps\.googleapis\.com/i.test(html);
}

function extractNap(
  html: string,
): { name: string | null; address: string | null; phone: string | null } {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

  const phoneMatch = text.match(
    /(?:\+?1[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/,
  );

  return {
    name: null,
    address: null,
    phone: phoneMatch?.[0]?.trim() || null,
  };
}

export const seoLocalSkill: SkillHandler = async (input, context) => {
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

  const jsonLdData = extractJsonLdLocalBusiness(html);
  const phoneNumbers = extractPhoneNumbers(html);
  const mapsEmbed = hasGoogleMapsEmbed(html);
  const napData = extractNap(html);

  const issues: string[] = [];
  if (!jsonLdData.hasLocalBusinessSchema) {
    issues.push("No LocalBusiness structured data found");
  }
  if (phoneNumbers.length === 0 && !napData.phone) {
    issues.push("No phone number detected on the page");
  }
  if (!mapsEmbed) {
    issues.push("No Google Maps embed detected");
  }
  if (jsonLdData.hasLocalBusinessSchema && !jsonLdData.geo) {
    issues.push("LocalBusiness schema missing geo coordinates");
  }
  if (jsonLdData.hasLocalBusinessSchema && !jsonLdData.openingHours) {
    issues.push("LocalBusiness schema missing opening hours");
  }

  return {
    success: true,
    url,
    localBusiness: {
      hasSchema: jsonLdData.hasLocalBusinessSchema || false,
      type: jsonLdData.localBusinessType || null,
      name: jsonLdData.name || null,
      address: jsonLdData.address || null,
      phone: jsonLdData.phone || null,
      geo: jsonLdData.geo || null,
      openingHours: jsonLdData.openingHours || null,
    },
    phoneNumbers,
    hasGoogleMapsEmbed: mapsEmbed,
    napFromPage: napData,
    issues,
    context: context.apiKeyId,
  };
};

export function registerSeoLocalSkill(executor: unknown & { registerHandler: (name: string, handler: SkillHandler) => void }): void {
  executor.registerHandler("seo_local", seoLocalSkill);
}
