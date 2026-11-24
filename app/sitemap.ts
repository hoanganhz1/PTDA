import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/search";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const products = getAllProducts();

  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/san-pham`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/tim-kiem`, changeFrequency: "monthly", priority: 0.4 },
    ...products.map((product) => ({
      url: `${siteUrl}/san-pham/${product.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
