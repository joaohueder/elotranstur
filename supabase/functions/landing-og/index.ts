// Edge Function: prévia de compartilhamento (Open Graph) das landing pages.
//
// O sistema é uma SPA: o WhatsApp/Facebook/Telegram NÃO executam JavaScript,
// por isso eles nunca enxergam as metatags geradas no navegador e acabam
// mostrando a imagem padrão da hospedagem.
//
// Esta função devolve um HTML estático (renderizado no servidor) com:
//   - og:image  -> foto de capa da viagem
//   - og:title  -> título da viagem
//   - og:description -> título + subtítulo
// e redireciona visitantes reais para a landing page da SPA.
//
// Deploy (self-hosted):
//   supabase functions deploy landing-og --no-verify-jwt
//
// Uso: https://<supabase>/functions/v1/landing-og/<slug>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";
// Domínio público do site (onde a SPA está publicada).
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://elotranstur.com.br")
  .replace(/\/+$/, "");

function escapar(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Imagem = { url?: string; capa?: boolean };

function capaDa(imagens: Imagem[] | null | undefined): string | null {
  const lista = Array.isArray(imagens) ? imagens : [];
  return (lista.find((i) => i?.capa) ?? lista[0])?.url ?? null;
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // aceita /functions/v1/landing-og/<slug> e ?slug=<slug>
  const partes = url.pathname.split("/").filter(Boolean);
  const slug = url.searchParams.get("slug") ?? partes[partes.length - 1];

  if (!slug || slug === "landing-og") {
    return html("<!doctype html><title>Viagem não encontrada</title>", 404);
  }

  const destino = `${SITE_URL}/v/${encodeURIComponent(slug)}`;

  let viagem: Record<string, unknown> | null = null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data } = await supabase.rpc("landing_viagem", { _slug: slug });
    viagem = (data ?? null) as Record<string, unknown> | null;
  } catch (_e) {
    viagem = null;
  }

  if (!viagem) {
    return html(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
        `<title>Viagem não encontrada</title>` +
        `<meta http-equiv="refresh" content="0;url=${escapar(SITE_URL)}">` +
        `</head><body></body></html>`,
      404,
    );
  }

  const titulo =
    String(viagem.titulo ?? "") || String(viagem.destino ?? "Viagem");
  const subtitulo = String(viagem.subtitulo ?? "");
  const descricao =
    [titulo, subtitulo].filter(Boolean).join(" — ") ||
    String(viagem.descricao ?? "").slice(0, 155);
  const imagem = capaDa(viagem.imagens as Imagem[] | null);

  const tags = [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="ELO Transporte e Turismo">`,
    `<meta property="og:title" content="${escapar(titulo)}">`,
    `<meta property="og:description" content="${escapar(descricao)}">`,
    `<meta property="og:url" content="${escapar(destino)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapar(titulo)}">`,
    `<meta name="twitter:description" content="${escapar(descricao)}">`,
    imagem
      ? `<meta property="og:image" content="${escapar(imagem)}">` +
        `<meta property="og:image:secure_url" content="${escapar(imagem)}">` +
        `<meta property="og:image:width" content="1200">` +
        `<meta property="og:image:height" content="630">` +
        `<meta name="twitter:image" content="${escapar(imagem)}">`
      : "",
    `<link rel="canonical" href="${escapar(destino)}">`,
  ].join("");

  return html(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      tags +
      `<meta http-equiv="refresh" content="0;url=${escapar(destino)}">` +
      `</head><body>` +
      `<p>Abrindo a página da viagem…</p>` +
      `<a href="${escapar(destino)}">${escapar(titulo)}</a>` +
      `<script>location.replace(${JSON.stringify(destino)});</script>` +
      `</body></html>`,
  );
});
