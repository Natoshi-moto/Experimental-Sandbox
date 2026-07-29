import generatedCatalogue from "../../.generated/content-catalogue.json";

export type InlineText = string;

export type ContentBlock =
  | { type: "paragraph"; text: InlineText }
  | { type: "heading"; level: 2 | 3; text: InlineText }
  | { type: "quote"; text: InlineText }
  | { type: "list"; ordered: boolean; items: InlineText[] }
  | { type: "code"; language: string; text: string };

export type PublishedItem = {
  slug: string;
  route: string;
  category:
    | "notes"
    | "positions"
    | "demonstrations"
    | "evidence"
    | "experiments";
  label: string;
  publishedAt: string;
  title: string;
  summary: string;
  body: ContentBlock[];
  sourceHash: string;
};

type Catalogue = {
  formatVersion: 1;
  items: PublishedItem[];
};

const catalogue = generatedCatalogue as Catalogue;

export const publishedItems = Object.freeze([...catalogue.items]);

export function findPublishedItem(slug: string) {
  return publishedItems.find((item) => item.slug === slug);
}

export function latestPublishedItem(
  category: PublishedItem["category"],
) {
  return publishedItems.find((item) => item.category === category);
}
