import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Rotas públicas que PODEM ser indexadas pelos buscadores. */
const ROTAS_INDEXAVEIS = [/^\/v\//];

/** Define a metatag robots da página. */
export function useRobots(noindex: boolean) {
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute(
      "content",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    );
  }, [noindex]);
}

/**
 * Aplica a política de indexação: o sistema (painel, login, recuperação de
 * senha) fica fora do Google; apenas as páginas públicas são indexáveis.
 */
export function RobotsPolicy() {
  const { pathname } = useLocation();
  useRobots(!ROTAS_INDEXAVEIS.some((r) => r.test(pathname)));
  return null;
}

type Seo = {
  title: string;
  description: string;
  /** URL absoluta da imagem de preview (og:image / twitter:image). */
  image?: string | null;
  /** URL canônica da página; por padrão usa a URL atual. */
  url?: string | null;
};

/** Define título e metatags da página (equivalente SPA ao head() das rotas). */
export function useSeo({ title, description, image, url }: Seo) {
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

    const remove = (attr: "name" | "property", key: string) => {
      document.head
        .querySelectorAll(`meta[${attr}="${key}"]`)
        .forEach((el) => el.remove());
    };

    const pageUrl =
      url ?? (typeof window !== "undefined" ? window.location.href : "");
    const absImage =
      image && typeof window !== "undefined"
        ? new URL(image, window.location.origin).href
        : image || "";

    set("name", "description", description);
    set("property", "og:title", title);
    set("property", "og:description", description);
    set("property", "og:type", "website");
    if (pageUrl) set("property", "og:url", pageUrl);
    set("name", "twitter:title", title);
    set("name", "twitter:description", description);

    if (absImage) {
      set("property", "og:image", absImage);
      set("property", "og:image:width", "1200");
      set("property", "og:image:height", "630");
      set("name", "twitter:image", absImage);
      set("name", "twitter:card", "summary_large_image");
    } else {
      remove("property", "og:image");
      remove("property", "og:image:width");
      remove("property", "og:image:height");
      remove("name", "twitter:image");
      set("name", "twitter:card", "summary_large_image");
    }

    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (pageUrl) {
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", pageUrl);
    }
  }, [title, description, image, url]);
}
