import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Loader2, Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpTip } from "@/components/help";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const PROPORCOES = [
  { key: "16:9", label: "16:9 (capa)", valor: 16 / 9 },
  { key: "4:3", label: "4:3", valor: 4 / 3 },
  { key: "1:1", label: "1:1 (quadrado)", valor: 1 },
] as const;

export type ProporcaoOpcao = { key: string; label: string; valor: number };

export type CropperOpcoes = {
  /** Lista de proporções disponíveis no modal. */
  proporcoes?: ProporcaoOpcao[];
  /** Proporção selecionada ao abrir. */
  proporcaoPadrao?: number;
  /** Texto de apoio exibido no cabeçalho do modal. */
  descricao?: string;
};


const LARGURA_PALCO = 560;

type Pendente = {
  arquivo: File;
  url: string;
  resolve: (resultado: File | null) => void;
};

/**
 * Modal de ajuste de corte da imagem.
 * Uso: const { cropperUi, ajustarCorte } = useImageCropper();
 */
export function useImageCropper(opcoes?: CropperOpcoes) {
  const listaProporcoes: ProporcaoOpcao[] =
    opcoes?.proporcoes ?? PROPORCOES.map((p) => ({ ...p }));
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [proporcao, setProporcao] = useState<number>(
    opcoes?.proporcaoPadrao ?? listaProporcoes[0].valor,
  );

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processando, setProcessando] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const arrasto = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const alturaPalco = Math.round(LARGURA_PALCO / proporcao);

  const ajustarCorte = useCallback((arquivo: File) => {
    return new Promise<File | null>((resolve) => {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPendente({ arquivo, url: URL.createObjectURL(arquivo), resolve });
    });
  }, []);

  const fechar = useCallback(
    (resultado: File | null) => {
      setPendente((atual) => {
        if (atual) {
          atual.resolve(resultado);
          URL.revokeObjectURL(atual.url);
        }
        return null;
      });
      setProcessando(false);
    },
    [],
  );

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [proporcao]);

  function limites(escala: number) {
    const img = imgRef.current;
    if (!img) return { maxX: 0, maxY: 0 };
    const base = Math.max(
      LARGURA_PALCO / img.naturalWidth,
      alturaPalco / img.naturalHeight,
    );
    const s = base * escala;
    return {
      maxX: Math.max(0, (img.naturalWidth * s - LARGURA_PALCO) / 2),
      maxY: Math.max(0, (img.naturalHeight * s - alturaPalco) / 2),
    };
  }

  function clamp(x: number, y: number, escala: number) {
    const { maxX, maxY } = limites(escala);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function aoMover(e: React.PointerEvent) {
    if (!arrasto.current) return;
    const d = arrasto.current;
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), zoom));
  }

  function alterarZoom(valor: number) {
    setZoom(valor);
    setOffset((o) => clamp(o.x, o.y, valor));
  }

  async function confirmar() {
    const img = imgRef.current;
    if (!pendente || !img) return;
    setProcessando(true);
    try {
      const base = Math.max(
        LARGURA_PALCO / img.naturalWidth,
        alturaPalco / img.naturalHeight,
      );
      const s = base * zoom;
      const esquerda = (LARGURA_PALCO - img.naturalWidth * s) / 2 + offset.x;
      const topo = (alturaPalco - img.naturalHeight * s) / 2 + offset.y;
      const sx = -esquerda / s;
      const sy = -topo / s;
      const sw = LARGURA_PALCO / s;
      const sh = alturaPalco / s;

      const larguraFinal = Math.min(1920, Math.round(sw));
      const alturaFinal = Math.round(larguraFinal / proporcao);

      const canvas = document.createElement("canvas");
      canvas.width = larguraFinal;
      canvas.height = alturaFinal;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, larguraFinal, alturaFinal);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, larguraFinal, alturaFinal);

      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob((b) => r(b), "image/png"),
      );
      if (!blob) throw new Error("Não foi possível gerar o recorte.");
      const nomeBase = pendente.arquivo.name.replace(/\.[^.]+$/, "");
      fechar(
        new File([blob], `${nomeBase}.png`, {
          type: "image/png",
          lastModified: Date.now(),
        }),
      );
    } catch {
      // Falhou o recorte: envia o arquivo original.
      fechar(pendente.arquivo);
    }
  }

  const escalaBase = imgRef.current
    ? Math.max(
        LARGURA_PALCO / imgRef.current.naturalWidth,
        alturaPalco / imgRef.current.naturalHeight,
      )
    : 1;

  const cropperUi = (
    <Dialog
      open={!!pendente}
      onOpenChange={(aberto) => {
        if (!aberto) fechar(null);
      }}
    >
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Crop className="h-4 w-4 text-brand-accent" />
            Ajustar corte da imagem
          </DialogTitle>
          <DialogDescription>
            {opcoes?.descricao ??
              "Arraste a imagem para posicionar e use o zoom. A área visível será salva na galeria."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Proporção
            <HelpTip texto="Formato do recorte: define o formato final da imagem." />
          </span>
          {listaProporcoes.map((p) => (

            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={proporcao === p.valor ? "default" : "outline"}
              onClick={() => setProporcao(p.valor)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div
          className={cn(
            "relative w-full max-w-full overflow-hidden rounded-sm border border-border bg-muted",
            "touch-none select-none",
          )}
          style={{ aspectRatio: String(proporcao) }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            arrasto.current = {
              x: e.clientX,
              y: e.clientY,
              ox: offset.x,
              oy: offset.y,
            };
          }}
          onPointerMove={aoMover}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
        >
          {pendente && (
            <img
              ref={imgRef}
              src={pendente.url}
              alt="Pré-visualização do recorte"
              draggable={false}
              onLoad={() => setOffset({ x: 0, y: 0 })}
              className="absolute left-1/2 top-1/2 max-w-none cursor-grab active:cursor-grabbing"
              style={{
                width: imgRef.current
                  ? imgRef.current.naturalWidth * escalaBase * zoom
                  : undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 border border-white/40" />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => alterarZoom(Math.max(1, Number((zoom - 0.1).toFixed(2))))}
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.01}
            onValueChange={(v) => alterarZoom(v[0])}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => alterarZoom(Math.min(4, Number((zoom + 0.1).toFixed(2))))}
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            aria-label="Restaurar enquadramento"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => fechar(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void confirmar()} disabled={processando}>
            {processando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Crop className="mr-2 h-4 w-4" />
            )}
            Aplicar corte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { cropperUi, ajustarCorte };
}
