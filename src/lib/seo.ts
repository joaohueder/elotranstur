import { useEffect } from "react";

type Seo = {
  title: string;
  description: string;
};

/** Define título e metatags da página (equivalente SPA ao head() das rotas). */
export function useSeo({ title, description }: Seo) {
  useEffect(() => {
    document.title = title;

    const set = (attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${key}"]`,
      );
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    set("name", "description", description);
    set("property", "og:title", title);
    set("property", "og:description", description);
    set("property", "og:type", "website");
    set("name", "twitter:card", "summary_large_image");
  }, [title, description]);
}
