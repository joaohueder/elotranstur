/**
 * Pré-renderização das landing pages (/v/:slug) — ELO Transporte e Turismo.
 *
 * WhatsApp, Facebook e Telegram NÃO executam JavaScript: eles leem apenas o
 * HTML entregue pelo servidor. Como o sistema é uma SPA, a prévia sempre caía
 * nas metatags genéricas do index.html.
 *
 * Este plugin roda no `npm run build`: busca as viagens com landing ativa e
 * grava um arquivo real `dist/v/<slug>/index.html` já com a foto de capa,
 * o título e o subtítulo. O visitante continua vendo a SPA normalmente,
 * porque o mesmo HTML carrega o app.
 */

const SUPABASE_URL =
  process.env.VITE_SELFHOSTED_SUPABASE_URL ||
  "https://supabase.vps10409.panel.icontainer.cloud";
const SUPABASE_ANON_KEY =
  process.env.VITE_SELFHOSTED_SUPABASE_ANON_KEY ||
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3ODU0NDkzNjgsImV4cCI6MjEwMDgwOTM2OCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.JJMSkX2HUdP9u1m-2MrOAfOCur5XR5slGLluqT3gwfk";
const SITE_URL = (process.env.VITE_SITE_URL || "https://elotranstur.com.br").replace(
  /\/+$/,
  "",
);

async function rpc(nome, body) {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!resposta.ok) throw new Error(`${nome}: HTTP ${resposta.status}`);
  return resposta.json();
}

function escapar(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capaDa(imagens) {
  const lista = Array.isArray(imagens) ? imagens : [];
  return (lista.find((i) => i?.capa) ?? lista[0])?.url ?? null;
}

/**
 * Gera uma cópia JPEG 1200x630 da capa dentro de dist/og/<slug>.jpg.
 * O WhatsApp costuma ignorar imagens WebP na prévia — o JPEG resolve.
 * Retorna a URL pública do JPEG ou null se não for possível converter.
 */
async function gerarCapaJpeg(dist, slug, urlImagem) {
  if (!urlImagem) return null;
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const { default: sharp } = await import("sharp");

    const resposta = await fetch(urlImagem);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const original = Buffer.from(await resposta.arrayBuffer());

    const jpeg = await sharp(original)
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    await mkdir(path.join(dist, "og"), { recursive: true });
    await writeFile(path.join(dist, "og", `${slug}.jpg`), jpeg);
    return `${SITE_URL}/og/${slug}.jpg`;
  } catch (err) {
    console.warn(`[landing] capa JPEG de ${slug} não gerada: ${err.message}`);
    return null;
  }
}


/** Troca/insere as metatags sociais do HTML da SPA. */
function montarHtml(base, viagem) {
  const titulo = viagem.titulo || viagem.destino || "Viagem";
  const descricao =
    [titulo, viagem.subtitulo].filter(Boolean).join(" — ") ||
    String(viagem.descricao ?? "").slice(0, 155);
  const imagem = capaDa(viagem.imagens);
  const url = `${SITE_URL}/v/${viagem.slug}`;

  const tags = [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="ELO Transporte e Turismo" />`,
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descricao)}" />`,
    `<meta property="og:url" content="${escapar(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapar(titulo)}" />`,
    `<meta name="twitter:description" content="${escapar(descricao)}" />`,
    `<link rel="canonical" href="${escapar(url)}" />`,
  ];
  if (imagem) {
    tags.push(
      `<meta property="og:image" content="${escapar(imagem)}" />`,
      `<meta property="og:image:secure_url" content="${escapar(imagem)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${escapar(titulo)}" />`,
      `<meta name="twitter:image" content="${escapar(imagem)}" />`,
    );
  }

  // Remove as metatags genéricas do index.html para não duplicar a prévia.
  const limpo = base
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, "")
    .replace(/<meta\s+property="og:[\s\S]*?\/>/gi, "")
    .replace(/<meta\s+name="twitter:[\s\S]*?\/>/gi, "");

  return limpo.replace(/<\/head>/i, `  ${tags.join("\n    ")}\n  </head>`);
}

export function prerenderLandings() {
  return {
    name: "elo-prerender-landings",
    apply: "build",
    async closeBundle() {
      const { readFile, writeFile, mkdir } = await import("node:fs/promises");
      const path = await import("node:path");
      const dist = path.resolve(process.cwd(), "dist");

      let base;
      try {
        base = await readFile(path.join(dist, "index.html"), "utf8");
      } catch {
        return;
      }

      let slugs = [];
      try {
        const dados = await rpc("landing_slugs");
        slugs = Array.isArray(dados) ? dados.map((d) => d?.slug ?? d).filter(Boolean) : [];
      } catch (err) {
        console.warn(
          `[landing] não foi possível listar as landing pages (${err.message}). ` +
            `Execute o SQL supabase/sql/030-landing-slugs-publicos.sql.`,
        );
        return;
      }

      for (const slug of slugs) {
        try {
          const viagem = await rpc("landing_viagem", { _slug: slug });
          if (!viagem) continue;
          const destino = path.join(dist, "v", slug);
          await mkdir(destino, { recursive: true });
          await writeFile(path.join(destino, "index.html"), montarHtml(base, viagem));
          // Cópia sem barra final, para servidores que não resolvem diretórios.
          await writeFile(path.join(dist, "v", `${slug}.html`), montarHtml(base, viagem));
        } catch (err) {
          console.warn(`[landing] falha ao gerar /v/${slug}: ${err.message}`);
        }
      }
      console.log(`[landing] prévias de compartilhamento geradas: ${slugs.length}`);
    },
  };
}
