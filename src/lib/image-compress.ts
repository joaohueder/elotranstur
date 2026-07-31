/**
 * Compressão de imagens no navegador (antes do upload).
 *
 * Objetivo: menor arquivo possível mantendo qualidade visual.
 * - Redimensiona para no máximo 1920px no maior lado (suficiente para web).
 * - Converte para WebP (30–50% menor que JPEG na mesma qualidade).
 * - Ajusta a qualidade automaticamente até ficar abaixo do limite de tamanho.
 */

export type CompressaoOpcoes = {
  /** Maior lado da imagem em pixels. */
  maxLado?: number;
  /** Tamanho alvo do arquivo final, em bytes. */
  maxBytes?: number;
  /** Qualidade inicial (0–1). */
  qualidadeInicial?: number;
  /** Qualidade mínima aceitável (0–1). */
  qualidadeMinima?: number;
};

const PADRAO: Required<CompressaoOpcoes> = {
  maxLado: 1920,
  maxBytes: 400 * 1024,
  qualidadeInicial: 0.86,
  qualidadeMinima: 0.6,
};

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function paraBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  qualidade: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), tipo, qualidade),
  );
}

/** Suporte a WebP no navegador atual. */
function suportaWebp(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Comprime uma imagem mantendo boa qualidade visual.
 * Retorna o arquivo original quando a compressão não traz ganho.
 */
export async function comprimirImagem(
  arquivo: File,
  opcoes: CompressaoOpcoes = {},
): Promise<File> {
  const cfg = { ...PADRAO, ...opcoes };

  // SVG e GIF (animado) não devem passar pelo canvas.
  if (arquivo.type === "image/svg+xml" || arquivo.type === "image/gif") {
    return arquivo;
  }

  try {
    const img = await carregarImagem(arquivo);
    const escala = Math.min(1, cfg.maxLado / Math.max(img.width, img.height));
    const largura = Math.round(img.width * escala);
    const altura = Math.round(img.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Fundo branco para imagens com transparência convertidas para WebP/JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);

    const tipo = suportaWebp() ? "image/webp" : "image/jpeg";
    const extensao = tipo === "image/webp" ? "webp" : "jpg";

    let qualidade = cfg.qualidadeInicial;
    let melhor: Blob | null = await paraBlob(canvas, tipo, qualidade);

    // Reduz a qualidade em passos pequenos até atingir o tamanho alvo.
    while (melhor && melhor.size > cfg.maxBytes && qualidade > cfg.qualidadeMinima) {
      qualidade = Math.max(cfg.qualidadeMinima, qualidade - 0.08);
      const tentativa = await paraBlob(canvas, tipo, qualidade);
      if (!tentativa) break;
      melhor = tentativa;
    }

    if (!melhor || melhor.size >= arquivo.size) return arquivo;

    const nomeBase = arquivo.name.replace(/\.[^.]+$/, "");
    return new File([melhor], `${nomeBase}.${extensao}`, {
      type: tipo,
      lastModified: Date.now(),
    });
  } catch {
    // Qualquer falha: envia o arquivo original.
    return arquivo;
  }
}

/** Formata bytes em texto legível (KB / MB). */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
