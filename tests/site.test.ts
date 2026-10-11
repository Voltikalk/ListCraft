import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_LISTINGS, EXAMPLE_INPUT } from "@/lib/demo-listing";
import { listingInputSchema, listingOutputSchema, MARKET_VALUES, MARKETS } from "@/lib/listing-schema";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("пример на лендинге", () => {
  it.each(MARKET_VALUES)("для рынка %s проходит те же проверки, что и настоящие данные", (market) => {
    expect(listingInputSchema.safeParse({ ...EXAMPLE_INPUT, market }).success).toBe(true);
    expect(listingOutputSchema.safeParse(DEMO_LISTINGS[market]).success).toBe(true);
    expect(DEMO_LISTINGS[market].title.length).toBeLessThanOrEqual(MARKETS[market].titleMax);
  });
});

describe("listingsCount", () => {
  it("склоняет слово «объявление» по числу", async () => {
    const { listingsCount } = await import("@/lib/site");
    expect([1, 2, 5, 11, 21, 22, 25].map(listingsCount)).toEqual([
      "1 объявление",
      "2 объявления",
      "5 объявлений",
      "11 объявлений",
      "21 объявление",
      "22 объявления",
      "25 объявлений",
    ]);
  });
});

describe("ссылки обратной связи", () => {
  it("не показываются, если почта не настроена или указана с ошибкой", async () => {
    for (const value of ["", "  ", "not-an-email", "a@b", "x@y.z?bcc=evil@example.com", "x@y.z?cc=1", "a b@c.d"]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", value);
      const site = await import("@/lib/site");
      expect(site.CONTACT_EMAIL).toBeNull();
      expect(site.mailtoHref("bug")).toBeNull();
    }
  });

  it("собирают mailto с закодированной темой", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", " hello@example.com ");
    const site = await import("@/lib/site");
    expect(site.CONTACT_EMAIL).toBe("hello@example.com");
    const href = site.mailtoHref("paid")!;
    expect(href.startsWith("mailto:hello@example.com?subject=")).toBe(true);
    const url = new URL(href);
    expect(url.searchParams.get("subject")).toContain("$4.99");
    expect(url.searchParams.get("body")).toContain("25 объявлений");
  });
});
