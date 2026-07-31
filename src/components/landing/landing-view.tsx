import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Send,
  Users,
  X,
} from "lucide-react";

import { getLandingModel, type LandingModel } from "@/lib/landing-models";
import {
  capaDa,
  formatarData,
  formatarHora,
  formatarValor,
  type ViagemImagem,
} from "@/lib/viagens";

export type LandingViagem = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  descricao: string | null;
  destino: string;
  data_partida: string;
  hora_partida: string | null;
  valor: number;
  vagas: number;
  itens_inclusos: string[] | null;
  imagens: ViagemImagem[] | null;
  modelo?: string | null;
  slug?: string | null;
};

type Props = {
  viagem: LandingViagem;
  modelo?: string | null;
  /** Envia o lead; retorna mensagem de erro ou null em caso de sucesso. */
  onSubmit?: (dados: {
    nome: string;
    whatsapp: string;
    mensagem: string;
  }) => Promise<string | null>;
  /** Modo demonstração: o formulário não envia nada. */
  preview?: boolean;
};

function themeVars(m: LandingModel): CSSProperties {
  return {
    ["--lp-bg" as string]: m.theme.bg,
    ["--lp-surface" as string]: m.theme.surface,
    ["--lp-fg" as string]: m.theme.fg,
    ["--lp-muted" as string]: m.theme.muted,
    ["--lp-border" as string]: m.theme.border,
    ["--lp-accent" as string]: m.theme.accent,
    ["--lp-accent-fg" as string]: m.theme.accentFg,
    ["--lp-radius" as string]: m.radius,
  };
}

function Foto({
  url,
  className,
  onClick,
}: {
  url: string | null;
  className?: string;
  onClick?: () => void;
}) {
  if (!url) {
    return (
      <div
        className={className}
        style={{ background: "var(--lp-surface)" }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onClick={onClick}
      className={`${className ?? ""}${onClick ? " cursor-zoom-in" : ""}`}
      style={{ objectFit: "cover" }}
    />
  );
}

/** Galeria em tela cheia com navegação entre as fotos. */
function Lightbox({
  urls,
  indice,
  onFechar,
  onIr,
}: {
  urls: string[];
  indice: number;
  onFechar: () => void;
  onIr: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight") onIr((indice + 1) % urls.length);
      if (e.key === "ArrowLeft") onIr((indice - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [indice, urls.length, onFechar, onIr]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
      onClick={onFechar}
    >
      <button
        type="button"
        aria-label="Fechar galeria"
        onClick={onFechar}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              onIr((indice - 1 + urls.length) % urls.length);
            }}
            className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={(e) => {
              e.stopPropagation();
              onIr((indice + 1) % urls.length);
            }}
            className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <img
        src={urls[indice]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full object-contain"
      />
      <span className="absolute bottom-5 text-xs uppercase tracking-[0.2em] text-white/80">
        {indice + 1} / {urls.length}
      </span>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        border: "1px solid var(--lp-border)",
        borderRadius: "var(--lp-radius)",
        background: "var(--lp-surface)",
      }}
    >
      <span style={{ color: "var(--lp-accent)" }}>{icon}</span>
      <span className="leading-tight">
        <span
          className="block text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--lp-muted)" }}
        >
          {label}
        </span>
        <span className="block text-sm font-medium">{value}</span>
      </span>
    </div>
  );
}

function Formulario({
  onSubmit,
  preview,
}: {
  onSubmit?: Props["onSubmit"];
  preview?: boolean;
}) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const inputStyle: CSSProperties = {
    background: "var(--lp-bg)",
    border: "1px solid var(--lp-border)",
    borderRadius: "var(--lp-radius)",
    color: "var(--lp-fg)",
  };

  if (ok) {
    return (
      <div
        className="p-6 text-center"
        style={{
          border: "1px solid var(--lp-border)",
          borderRadius: "var(--lp-radius)",
          background: "var(--lp-surface)",
        }}
      >
        <span
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full"
          style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
        >
          <Check className="h-5 w-5" />
        </span>
        <p className="text-base font-semibold">Recebemos o seu contato!</p>
        <p className="mt-1 text-sm" style={{ color: "var(--lp-muted)" }}>
          Em breve nossa equipe fala com você no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 p-5"
      style={{
        border: "1px solid var(--lp-border)",
        borderRadius: "var(--lp-radius)",
        background: "var(--lp-surface)",
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        if (preview || !onSubmit) {
          setOk(true);
          return;
        }
        setEnviando(true);
        const msg = await onSubmit({ nome, whatsapp, mensagem });
        setEnviando(false);
        if (msg) setErro(msg);
        else setOk(true);
      }}
    >
      <div>
        <p className="text-lg font-semibold">Quero saber mais</p>
        <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
          Deixe seus dados e receba todos os detalhes desta viagem.
        </p>
      </div>

      <input
        required
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        aria-label="Seu nome"
        className="h-11 w-full px-3 text-sm outline-none"
        style={inputStyle}
      />
      <input
        required
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="Seu WhatsApp (com DDD)"
        aria-label="Seu WhatsApp"
        inputMode="tel"
        className="h-11 w-full px-3 text-sm outline-none"
        style={inputStyle}
      />
      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        placeholder="Mensagem (opcional)"
        aria-label="Mensagem"
        rows={3}
        className="w-full resize-none px-3 py-2 text-sm outline-none"
        style={inputStyle}
      />

      {erro && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex h-11 w-full items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-60"
        style={{
          background: "var(--lp-accent)",
          color: "var(--lp-accent-fg)",
          borderRadius: "var(--lp-radius)",
        }}
      >
        <Send className="h-4 w-4" />
        {enviando ? "Enviando..." : "Quero reservar"}
      </button>
      <p className="text-center text-[11px]" style={{ color: "var(--lp-muted)" }}>
        Sem compromisso. Seus dados ficam protegidos.
      </p>
    </form>
  );
}

/** Renderiza a landing page da viagem no modelo escolhido. */
export function LandingView({ viagem, modelo, onSubmit, preview }: Props) {
  const m = useMemo(
    () => getLandingModel(modelo ?? viagem.modelo),
    [modelo, viagem.modelo],
  );

  const imagens = viagem.imagens ?? [];
  const capa = capaDa(imagens);
  const galeria = imagens.slice(0, 6);
  const todasFotos = Array.from(
    new Set([capa, ...galeria.map((i) => i.url)]),
  ).filter((u): u is string => !!u);
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  const [capaSelecionada, setCapaSelecionada] = useState<string | null>(null);
  const capaAtiva = capaSelecionada ?? capa;
  const abrirFoto = (url: string | null) => {
    if (!url) return;
    const i = todasFotos.indexOf(url);
    if (i >= 0) setFotoAberta(i);
  };
  const itens = viagem.itens_inclusos ?? [];
  const titulo = viagem.titulo?.trim() || viagem.destino;
  const fonte = m.fonte === "serif" ? "font-serif" : "font-sans";

  const infos = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Info
        icon={<MapPin className="h-4 w-4" />}
        label="Destino"
        value={viagem.destino}
      />
      <Info
        icon={<CalendarDays className="h-4 w-4" />}
        label="Partida"
        value={formatarData(viagem.data_partida)}
      />
      <Info
        icon={<Clock className="h-4 w-4" />}
        label="Horário"
        value={formatarHora(viagem.hora_partida)}
      />
      <Info
        icon={<Users className="h-4 w-4" />}
        label="Vagas"
        value={viagem.vagas > 0 ? `${viagem.vagas} lugares` : "Consulte"}
      />
    </div>
  );

  const preco = (
    <div className="flex items-baseline gap-2">
      <span
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--lp-muted)" }}
      >
        A partir de
      </span>
      <span className={`text-3xl ${fonte}`} style={{ color: "var(--lp-accent)" }}>
        {formatarValor(viagem.valor)}
      </span>
      <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
        por pessoa
      </span>
    </div>
  );

  const inclusos = itens.length > 0 && (
    <div>
      <p
        className="mb-3 text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--lp-muted)" }}
      >
        O que está incluso
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {itens.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-start gap-2 text-sm">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--lp-accent)" }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const descricao = viagem.descricao && (
    <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--lp-muted)" }}>
      {viagem.descricao}
    </p>
  );

  const miniGaleria = galeria.length > 0 && (
    <div className="space-y-3">
      <p
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--lp-muted)" }}
      >
        Galeria
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {galeria.map((img) => (
          <Foto
            key={img.url}
            url={img.url}
            className={`aspect-[4/3] w-full transition ${
              capaAtiva === img.url
                ? "opacity-100 ring-2 ring-offset-2"
                : "opacity-80 hover:opacity-100"
            }`}
            onClick={() => setCapaSelecionada(img.url)}
          />
        ))}
      </div>
    </div>
  );

  const cabecalho = (
    <div className="space-y-3">
      <span
        className="inline-block px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{
          background: "var(--lp-accent)",
          color: "var(--lp-accent-fg)",
          borderRadius: "var(--lp-radius)",
        }}
      >
        {formatarData(viagem.data_partida)}
      </span>
      <h1 className={`text-4xl leading-tight sm:text-5xl ${fonte}`}>{titulo}</h1>
      {viagem.subtitulo && (
        <p className="text-base" style={{ color: "var(--lp-muted)" }}>
          {viagem.subtitulo}
        </p>
      )}
    </div>
  );

  const formulario = <Formulario onSubmit={onSubmit} preview={preview} />;

  const rodape = (
    <footer
      className="mt-12 border-t pt-6 text-center text-[10px] uppercase tracking-[0.24em]"
      style={{ borderColor: "var(--lp-border)", color: "var(--lp-muted)" }}
    >
      ELO Transporte e Turismo
    </footer>
  );

  const wrapper = (children: ReactNode) => (
    <div
      className={`min-h-full w-full ${fonte === "font-serif" ? "font-sans" : "font-sans"}`}
      style={{ ...themeVars(m), background: "var(--lp-bg)", color: "var(--lp-fg)" }}
    >
      {children}
      {fotoAberta !== null && (
        <Lightbox
          urls={todasFotos}
          indice={fotoAberta}
          onFechar={() => setFotoAberta(null)}
          onIr={(i) => setFotoAberta(i)}
        />
      )}
    </div>
  );

  // ---- Layouts --------------------------------------------------------
  if (m.layout === "split") {
    return wrapper(
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <div className="space-y-8">
          <Foto
            onClick={() => abrirFoto(capaAtiva)}
            url={capaAtiva}
            className="aspect-[4/3] w-full"
          />
          {miniGaleria}
        </div>
        <div className="space-y-7">
          {cabecalho}
          {preco}
          {descricao}
          {infos}
          {inclusos}
          {formulario}
        </div>
        <div className="lg:col-span-2">{rodape}</div>
      </div>,
    );
  }

  if (m.layout === "overlay") {
    return wrapper(
      <div>
        <div className="relative h-[62vh] min-h-[380px] w-full overflow-hidden">
          <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="absolute inset-0 h-full w-full" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-10 text-white">
            <h1 className={`max-w-3xl text-4xl leading-tight sm:text-6xl ${fonte}`}>
              {titulo}
            </h1>
            {viagem.subtitulo && (
              <p className="mt-3 max-w-2xl text-base opacity-90">{viagem.subtitulo}</p>
            )}
          </div>
        </div>
        {miniGaleria && (
          <div className="mx-auto max-w-5xl px-5 pt-10">{miniGaleria}</div>
        )}
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-8">
            {preco}
            {descricao}
            {infos}
            {inclusos}
          </div>
          <div className="lg:sticky lg:top-10 lg:self-start">{formulario}</div>
          <div className="lg:col-span-2">{rodape}</div>
        </div>
      </div>,
    );
  }

  if (m.layout === "stack") {
    return wrapper(
      <div className="mx-auto max-w-4xl space-y-10 px-5 py-12">
        <div className="text-center">{cabecalho}</div>
        <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="aspect-[16/9] w-full" />
        <div className="mx-auto max-w-2xl space-y-8 text-center">
          <div className="flex justify-center">{preco}</div>
          {descricao}
        </div>
        {infos}
        {inclusos}
        {miniGaleria}
        <div className="mx-auto max-w-md">{formulario}</div>
        {rodape}
      </div>,
    );
  }

  if (m.layout === "magazine") {
    return wrapper(
      <div className="mx-auto max-w-5xl px-5 py-12">
        <div
          className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6"
          style={{ borderColor: "var(--lp-border)" }}
        >
          <div className="max-w-2xl space-y-2">
            <p
              className="text-[10px] uppercase tracking-[0.3em]"
              style={{ color: "var(--lp-muted)" }}
            >
              Roteiro · {formatarData(viagem.data_partida)}
            </p>
            <h1 className={`text-4xl leading-tight sm:text-5xl ${fonte}`}>{titulo}</h1>
            {viagem.subtitulo && (
              <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
                {viagem.subtitulo}
              </p>
            )}
          </div>
          {preco}
        </div>

        <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="mb-8 aspect-[21/9] w-full" />
        {miniGaleria && <div className="mb-10">{miniGaleria}</div>}

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-8">
            {descricao}
            {inclusos}
          </div>
          <div className="space-y-6">
            {infos}
            {formulario}
          </div>
        </div>
        {rodape}
      </div>,
    );
  }

  if (m.layout === "poster") {
    return wrapper(
      <div className="mx-auto max-w-5xl px-5 py-12">
        <h1
          className={`text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl ${fonte}`}
        >
          {titulo}
        </h1>
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y py-4"
          style={{ borderColor: "var(--lp-border)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--lp-muted)" }}>
            {viagem.subtitulo || viagem.destino}
          </span>
          {preco}
        </div>
        <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="mt-8 aspect-[16/7] w-full" />
        {miniGaleria && <div className="mt-8">{miniGaleria}</div>}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            {descricao}
            {infos}
          </div>
          <div className="space-y-8">
            {inclusos}
            {formulario}
          </div>
        </div>
        {rodape}
      </div>,
    );
  }

  if (m.layout === "minimal") {
    return wrapper(
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="space-y-4">
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: "var(--lp-muted)" }}
          >
            {viagem.destino} · {formatarData(viagem.data_partida)}
          </p>
          <h1 className={`text-4xl leading-tight ${fonte}`}>{titulo}</h1>
          {viagem.subtitulo && (
            <p className="text-base" style={{ color: "var(--lp-muted)" }}>
              {viagem.subtitulo}
            </p>
          )}
        </div>
        <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="my-10 aspect-[3/2] w-full" />
        <div className="space-y-10">
          {preco}
          {descricao}
          {infos}
          {inclusos}
          {miniGaleria}
          {formulario}
        </div>
        {rodape}
      </div>,
    );
  }

  // card
  return wrapper(
    <div className="px-4 py-10 sm:py-14">
      <div
        className="mx-auto max-w-4xl overflow-hidden"
        style={{
          background: "var(--lp-surface)",
          borderRadius: "var(--lp-radius)",
          border: "1px solid var(--lp-border)",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.45)",
        }}
      >
        <Foto onClick={() => abrirFoto(capaAtiva)} url={capaAtiva} className="aspect-[16/8] w-full" />
        <div className="space-y-8 p-6 sm:p-10">
          {cabecalho}
          {preco}
          {descricao}
          {infos}
          {inclusos}
          {miniGaleria}
          {formulario}
        </div>
      </div>
      <div className="mx-auto max-w-4xl">{rodape}</div>
    </div>,
  );
}
