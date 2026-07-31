import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Anchor,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  Flame,
  Hash,
  MapPin,
  Navigation,
  Plane,
  Send,
  ShieldCheck,
  Square,
  Star,
  Ticket,
  Timer,
  Users,
  X,
} from "lucide-react";

import {
  getLandingModel,
  type LandingModel,
} from "@/lib/landing-models";
import { getLandingPalette, type LandingPalette } from "@/lib/landing-palettes";
import { formatWhatsapp } from "@/lib/crm";
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
  paleta?: string | null;
  slug?: string | null;
};

type Props = {
  viagem: LandingViagem;
  modelo?: string | null;
  paleta?: string | null;
  /** Envia o lead; retorna mensagem de erro ou null em caso de sucesso. */
  onSubmit?: (dados: {
    nome: string;
    whatsapp: string;
  }) => Promise<string | null>;
  /** Link do WhatsApp da empresa aberto após o envio (com nome e destino). */
  whatsappUrl?: (dados: { nome: string; whatsapp: string }) => string | null;
  /** Modo demonstração: o formulário não envia nada. */
  preview?: boolean;
};

/* ------------------------------------------------------------------ */
/* Fontes                                                              */
/* ------------------------------------------------------------------ */

const fontesCarregadas = new Set<string>();

function useGoogleFont(query: string) {
  useEffect(() => {
    if (fontesCarregadas.has(query)) return;
    fontesCarregadas.add(query);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
    document.head.appendChild(link);
  }, [query]);
}

/* ------------------------------------------------------------------ */
/* Ícones por modelo                                                   */
/* ------------------------------------------------------------------ */

const ICONES = {
  classico: { destino: MapPin, data: CalendarDays, hora: Clock, vagas: Users, marca: Star },
  viagem: { destino: Plane, data: CalendarDays, hora: Timer, vagas: Users, marca: Compass },
  geometrico: { destino: Square, data: Hash, hora: Circle, vagas: Users, marca: ArrowRight },
  bussola: { destino: Navigation, data: CalendarDays, hora: Clock, vagas: Users, marca: Anchor },
  bilhete: { destino: Bus, data: Ticket, hora: Clock, vagas: Users, marca: Ticket },
} as const;

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

function themeVars(m: LandingModel, p: LandingPalette): CSSProperties {
  return {
    ["--lp-bg" as string]: p.bg,
    ["--lp-surface" as string]: p.surface,
    ["--lp-fg" as string]: p.fg,
    ["--lp-muted" as string]: p.muted,
    ["--lp-border" as string]: p.border,
    ["--lp-accent" as string]: p.accent,
    ["--lp-accent2" as string]: p.accent2,
    ["--lp-accent-fg" as string]: p.accentFg,
    ["--lp-radius" as string]: m.radius,
    ["--lp-title" as string]: m.fonts.titulo,
    ["--lp-body" as string]: m.fonts.corpo,
    fontFamily: "var(--lp-body)",
  };
}

/* ------------------------------------------------------------------ */
/* Galeria em slider                                                   */
/* ------------------------------------------------------------------ */

function Slider({
  urls,
  aspect = "aspect-[4/3]",
  radius = true,
  className,
  overlay,
  onAmpliar,
  miniaturas = true,
}: {
  urls: string[];
  aspect?: string;
  radius?: boolean;
  className?: string;
  overlay?: ReactNode;
  onAmpliar?: (i: number) => void;
  miniaturas?: boolean;
}) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = urls.length;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (total < 2 || pausado) return;
    timer.current = window.setInterval(
      () => setI((v) => (v + 1) % total),
      5000,
    );
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [total, pausado]);

  useEffect(() => {
    if (i >= total) setI(0);
  }, [i, total]);

  if (total === 0) {
    return (
      <div
        className={`${aspect} w-full ${className ?? ""}`}
        style={{
          background: "var(--lp-surface)",
          borderRadius: radius ? "var(--lp-radius)" : undefined,
        }}
        aria-hidden
      />
    );
  }

  const ir = (novo: number) => setI(((novo % total) + total) % total);

  return (
    <div className={className}>
      <div
        className={`relative w-full overflow-hidden ${aspect}`}
        style={{ borderRadius: radius ? "var(--lp-radius)" : undefined }}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
      >
        {urls.map((url, idx) => (
          <img
            key={url + idx}
            src={url}
            alt=""
            loading={idx === 0 ? "eager" : "lazy"}
            onClick={() => onAmpliar?.(idx)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              idx === i ? "opacity-100" : "opacity-0"
            } ${onAmpliar ? "cursor-zoom-in" : ""}`}
          />
        ))}

        {overlay}

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation();
                ir(i - 1);
              }}
              className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={(e) => {
                e.stopPropagation();
                ir(i + 1);
              }}
              className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
              {urls.map((u, idx) => (
                <button
                  key={`dot-${u}-${idx}`}
                  type="button"
                  aria-label={`Ir para a foto ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    ir(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === i ? "w-6 bg-white" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {miniaturas && total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {urls.map((url, idx) => (
            <button
              key={`thumb-${url}-${idx}`}
              type="button"
              onClick={() => ir(idx)}
              aria-label={`Ver foto ${idx + 1}`}
              className="h-14 w-20 shrink-0 overflow-hidden transition"
              style={{
                borderRadius: "var(--lp-radius)",
                outline:
                  idx === i ? "2px solid var(--lp-accent)" : "1px solid var(--lp-border)",
                opacity: idx === i ? 1 : 0.65,
              }}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Galeria em tela cheia. */
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

/* ------------------------------------------------------------------ */
/* Contagem regressiva                                                 */
/* ------------------------------------------------------------------ */

function Countdown({ data, hora }: { data: string; hora: string | null }) {
  const alvo = useMemo(
    () => new Date(`${data}T${(hora || "00:00").slice(0, 5)}:00`).getTime(),
    [data, hora],
  );
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const restante = Math.max(0, alvo - agora);
  if (!alvo || Number.isNaN(alvo)) return null;

  const dias = Math.floor(restante / 86400000);
  const horas = Math.floor((restante % 86400000) / 3600000);
  const min = Math.floor((restante % 3600000) / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  const partes = [
    { v: dias, l: "dias" },
    { v: horas, l: "horas" },
    { v: min, l: "min" },
    { v: seg, l: "seg" },
  ];

  return (
    <div className="flex items-center gap-2">
      {partes.map((p) => (
        <div
          key={p.l}
          className="min-w-[58px] px-2 py-2 text-center"
          style={{
            background: "var(--lp-surface)",
            border: "1px solid var(--lp-border)",
            borderRadius: "var(--lp-radius)",
          }}
        >
          <span
            className="block text-xl font-bold leading-none tabular-nums"
            style={{ color: "var(--lp-accent)" }}
          >
            {String(p.v).padStart(2, "0")}
          </span>
          <span
            className="mt-1 block text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "var(--lp-muted)" }}
          >
            {p.l}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Botão principal                                                     */
/* ------------------------------------------------------------------ */

function ctaStyle(m: LandingModel): CSSProperties {
  const base: CSSProperties = {
    borderRadius: m.cta === "bloco" ? "0" : "var(--lp-radius)",
  };
  if (m.cta === "gradiente")
    return {
      ...base,
      background: "linear-gradient(100deg, var(--lp-accent), var(--lp-accent2))",
      color: "var(--lp-accent-fg)",
    };
  if (m.cta === "contorno")
    return {
      ...base,
      background: "transparent",
      color: "var(--lp-accent)",
      border: "1.5px solid var(--lp-accent)",
    };
  if (m.cta === "brilho")
    return {
      ...base,
      background: "var(--lp-accent)",
      color: "var(--lp-accent-fg)",
      boxShadow: "0 12px 34px -10px var(--lp-accent)",
    };
  return { ...base, background: "var(--lp-accent)", color: "var(--lp-accent-fg)" };
}

/* ------------------------------------------------------------------ */
/* Formulário de lead                                                  */
/* ------------------------------------------------------------------ */

function Formulario({
  m,
  onSubmit,
  whatsappUrl,
  preview,
}: {
  m: LandingModel;
  onSubmit?: Props["onSubmit"];
  whatsappUrl?: Props["whatsappUrl"];
  preview?: boolean;
}) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [linkWhats, setLinkWhats] = useState<string | null>(null);

  const inputStyle: CSSProperties = {
    background: "var(--lp-bg)",
    border: "1px solid var(--lp-border)",
    borderRadius: "var(--lp-radius)",
    color: "var(--lp-fg)",
  };

  const caixa: CSSProperties = {
    border: "1px solid var(--lp-border)",
    borderRadius: "var(--lp-radius)",
    background: "var(--lp-surface)",
  };

  if (ok) {
    return (
      <div className="p-6 text-center" style={caixa} id="reservar">
        <span
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full"
          style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
        >
          <Check className="h-5 w-5" />
        </span>
        <p className="text-base font-semibold">Recebemos o seu contato!</p>
        <p className="mt-1 text-sm" style={{ color: "var(--lp-muted)" }}>
          {linkWhats
            ? "Estamos abrindo o WhatsApp para você falar com a agência."
            : "Em breve nossa equipe fala com você no WhatsApp."}
        </p>
        {linkWhats && (
          <a
            href={linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
            style={ctaStyle(m)}
          >
            <Send className="h-4 w-4" />
            Abrir o WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      id="reservar"
      className="space-y-3 p-5"
      style={caixa}
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        if (nome.trim().length < 2) {
          setErro("Informe seu nome.");
          return;
        }
        if (whatsapp.replace(/\D/g, "").length < 10) {
          setErro("Informe um WhatsApp válido com DDD.");
          return;
        }
        const dados = { nome: nome.trim(), whatsapp };
        const url = whatsappUrl?.(dados) ?? null;
        setLinkWhats(url);
        // A janela é aberta ainda dentro do clique para não ser bloqueada.
        const janela = url ? window.open("", "_blank", "noopener") : null;

        if (preview || !onSubmit) {
          if (janela && url) janela.location.href = url;
          setOk(true);
          return;
        }
        setEnviando(true);
        const msg = await onSubmit(dados);
        setEnviando(false);
        if (msg) {
          janela?.close();
          setErro(msg);
          return;
        }
        if (url) {
          if (janela) janela.location.href = url;
          else window.location.href = url;
        }
        setOk(true);
      }}
    >
      <div>
        <p
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--lp-title)" }}
        >
          Fale com a agência
        </p>
        <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
          Preencha e um consultor entra em contato pelo WhatsApp.
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
        onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
        placeholder="(11) 90000-0000"
        aria-label="Seu WhatsApp"
        inputMode="tel"
        maxLength={15}
        className="h-11 w-full px-3 text-sm outline-none"
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
        className="flex h-12 w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] transition hover:brightness-110 disabled:opacity-60"
        style={ctaStyle(m)}
      >
        <Send className="h-4 w-4" />
        {enviando ? "Enviando..." : m.ctaLabel}
      </button>
      <p
        className="flex items-center justify-center gap-1.5 text-center text-[11px]"
        style={{ color: "var(--lp-muted)" }}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Sem compromisso. Seus dados ficam protegidos.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* LandingView                                                         */
/* ------------------------------------------------------------------ */

export function LandingView({
  viagem,
  modelo,
  paleta,
  onSubmit,
  whatsappUrl,
  preview,
}: Props) {
  const m = useMemo(
    () => getLandingModel(modelo ?? viagem.modelo),
    [modelo, viagem.modelo],
  );
  const p = useMemo(
    () => getLandingPalette(paleta ?? viagem.paleta ?? m.paletaPadrao),
    [paleta, viagem.paleta, m.paletaPadrao],
  );
  useGoogleFont(m.fonts.google);

  /* Aumenta a tipografia base em mobile para melhor legibilidade. */
  useEffect(() => {
    document.documentElement.classList.add("landing-mobile-larger-font");
    return () => {
      document.documentElement.classList.remove("landing-mobile-larger-font");
    };
  }, []);

  const imagens = viagem.imagens ?? [];
  const capa = capaDa(imagens);
  const fotos = Array.from(
    new Set([capa, ...imagens.map((i) => i.url)].filter((u): u is string => !!u)),
  );
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  const itens = viagem.itens_inclusos ?? [];
  const titulo = viagem.titulo?.trim() || viagem.destino;
  const Ico = ICONES[m.icones];

  const tituloStyle: CSSProperties = {
    fontFamily: "var(--lp-title)",
    fontWeight: m.peso,
    letterSpacing: m.tracking,
    textTransform: m.caixaAlta ? "uppercase" : "none",
  };

  const caixa: CSSProperties = {
    border: "1px solid var(--lp-border)",
    borderRadius: "var(--lp-radius)",
    background: "var(--lp-surface)",
  };

  /* ---- blocos reutilizáveis ---- */

  const galeria = (
    <Slider urls={fotos} onAmpliar={(i) => setFotoAberta(i)} />
  );

  const dadosInfo = [
    { icon: <Ico.destino className="h-4 w-4" />, label: "Destino", value: viagem.destino },
    { icon: <Ico.data className="h-4 w-4" />, label: "Partida", value: formatarData(viagem.data_partida) },
    { icon: <Ico.hora className="h-4 w-4" />, label: "Horário", value: formatarHora(viagem.hora_partida) },
    { icon: <Ico.vagas className="h-4 w-4" />, label: "Vagas", value: `${viagem.vagas || 0} lugares` },
  ];

  const infos = (() => {
    if (m.blocos === "pilulas") {
      return (
        <div className="flex flex-wrap gap-2">
          {dadosInfo.map((d) => (
            <span
              key={d.label}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm"
              style={{
                border: "1px solid var(--lp-border)",
                borderRadius: "999px",
                background: "var(--lp-surface)",
              }}
            >
              <span style={{ color: "var(--lp-accent)" }}>{d.icon}</span>
              <span className="font-medium">{d.value}</span>
            </span>
          ))}
        </div>
      );
    }
    if (m.blocos === "linhas") {
      return (
        <div style={{ borderTop: "1px solid var(--lp-border)" }}>
          {dadosInfo.map((d) => (
            <div
              key={d.label}
              className="flex items-center justify-between gap-4 py-3"
              style={{ borderBottom: "1px solid var(--lp-border)" }}
            >
              <span
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--lp-muted)" }}
              >
                <span style={{ color: "var(--lp-accent)" }}>{d.icon}</span>
                {d.label}
              </span>
              <span className="text-sm font-medium">{d.value}</span>
            </div>
          ))}
        </div>
      );
    }
    if (m.blocos === "faixa") {
      return (
        <div
          className="grid grid-cols-2 sm:grid-cols-4"
          style={{ ...caixa, overflow: "hidden" }}
        >
          {dadosInfo.map((d, i) => (
            <div
              key={d.label}
              className="p-4"
              style={{
                borderRight: i < 3 ? "1px solid var(--lp-border)" : undefined,
              }}
            >
              <span style={{ color: "var(--lp-accent)" }}>{d.icon}</span>
              <span
                className="mt-2 block text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--lp-muted)" }}
              >
                {d.label}
              </span>
              <span className="block text-sm font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      );
    }
    if (m.blocos === "grade") {
      return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dadosInfo.map((d) => (
            <div key={d.label} className="p-4" style={caixa}>
              <span style={{ color: "var(--lp-accent)" }}>{d.icon}</span>
              <span
                className="mt-2 block text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--lp-muted)" }}
              >
                {d.label}
              </span>
              <span className="block text-sm font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {dadosInfo.map((d) => (
          <div key={d.label} className="flex items-center gap-3 p-3" style={caixa}>
            <span style={{ color: "var(--lp-accent)" }}>{d.icon}</span>
            <span className="leading-tight">
              <span
                className="block text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--lp-muted)" }}
              >
                {d.label}
              </span>
              <span className="block text-sm font-medium">{d.value}</span>
            </span>
          </div>
        ))}
      </div>
    );
  })();

  const preco = (
    <div className="flex items-end gap-2">
      <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
        a partir de
      </span>
      <span className="text-4xl leading-none" style={{ ...tituloStyle, color: "var(--lp-accent)" }}>
        {formatarValor(viagem.valor)}
      </span>
      <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
        por pessoa
      </span>
    </div>
  );

  const selo = m.escassez && (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{
        background: "var(--lp-accent)",
        color: "var(--lp-accent-fg)",
        borderRadius: "999px",
      }}
    >
      <Flame className="h-3.5 w-3.5" />
      {viagem.vagas > 0 ? `Últimas ${viagem.vagas} vagas` : "Vagas limitadas"}
    </span>
  );

  const contagem = m.countdown && (
    <div className="space-y-2">
      <p
        className="text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--lp-muted)" }}
      >
        A viagem começa em
      </p>
      <Countdown data={viagem.data_partida} hora={viagem.hora_partida} />
    </div>
  );

  const inclusos = itens.length > 0 && (
    <div>
      <p className="mb-3 text-lg" style={tituloStyle}>
        O que está incluso
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {itens.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--lp-accent)" }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const descricao = viagem.descricao && (
    <div>
      <p className="mb-3 text-lg" style={tituloStyle}>
        Sobre a viagem
      </p>
      <p
        className="whitespace-pre-line text-sm leading-relaxed"
        style={{ color: "var(--lp-muted)" }}
      >
        {viagem.descricao}
      </p>
    </div>
  );

  const cabecalho = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{
            border: "1px solid var(--lp-border)",
            color: "var(--lp-accent)",
            borderRadius: "999px",
          }}
        >
          <Ico.marca className="h-3.5 w-3.5" />
          {formatarData(viagem.data_partida)}
        </span>
        {selo}
      </div>
      <h1 className="text-4xl leading-[1.05] sm:text-5xl" style={tituloStyle}>
        {titulo}
      </h1>
      {viagem.subtitulo && (
        <p className="text-base" style={{ color: "var(--lp-muted)" }}>
          {viagem.subtitulo}
        </p>
      )}
    </div>
  );

  const formulario = (
    <Formulario
      m={m}
      onSubmit={onSubmit}
      whatsappUrl={whatsappUrl}
      preview={preview}
    />
  );

  const botaoAncora = (
    <a
      href="#reservar"
      className="inline-flex h-12 items-center justify-center gap-2 px-7 text-xs font-bold uppercase tracking-[0.16em] transition hover:brightness-110"
      style={ctaStyle(m)}
    >
      {m.ctaLabel}
      <ArrowRight className="h-4 w-4" />
    </a>
  );

  const rodape = (
    <footer
      className="mt-12 border-t pt-6 text-center text-[10px] uppercase tracking-[0.24em]"
      style={{ borderColor: "var(--lp-border)", color: "var(--lp-muted)" }}
    >
      ELO Transporte e Turismo
    </footer>
  );

  /** Conteúdo detalhado usado abaixo do hero. */
  const corpo = (
    <div className="space-y-10">
      {infos}
      {descricao}
      {inclusos}
    </div>
  );

  const wrapper = (children: ReactNode) => (
    <div
      className="min-h-full w-full"
      style={{ ...themeVars(m, p), background: "var(--lp-bg)", color: "var(--lp-fg)" }}
    >
      {children}
      {fotoAberta !== null && (
        <Lightbox
          urls={fotos}
          indice={fotoAberta}
          onFechar={() => setFotoAberta(null)}
          onIr={(i) => setFotoAberta(i)}
        />
      )}
    </div>
  );

  /* ---------------- 1. Aurora — split ---------------- */
  if (m.hero === "split") {
    return wrapper(
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
        <div className="space-y-8">
          {galeria}
          {contagem}
          {descricao}
          {inclusos}
        </div>
        <div className="space-y-7 lg:sticky lg:top-8 lg:self-start">
          {cabecalho}
          {preco}
          {infos}
          {formulario}
        </div>
        <div className="lg:col-span-2">{rodape}</div>
      </div>,
    );
  }

  /* ---------------- 2. Impacto — fullbleed ---------------- */
  if (m.hero === "fullbleed") {
    return wrapper(
      <div>
        <div className="relative">
          <Slider
            urls={fotos}
            aspect="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"
            radius={false}
            miniaturas={false}
            overlay={
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,.55) 55%, rgba(0,0,0,.88) 100%)",
                }}
              />
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="pointer-events-auto mx-auto grid max-w-6xl gap-8 px-5 pb-10 lg:grid-cols-[1.3fr_.9fr]">
              <div className="space-y-4 text-white">
                {selo}
                <h1
                  className="text-5xl leading-[0.95] sm:text-7xl"
                  style={{ ...tituloStyle, color: "#fff" }}
                >
                  {titulo}
                </h1>
                {viagem.subtitulo && (
                  <p className="max-w-xl text-base opacity-90">{viagem.subtitulo}</p>
                )}
              </div>
             <div className="hidden lg:block">{formulario}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            {preco}
            {contagem}
          </div>
          {corpo}
          <div className="mx-auto max-w-lg lg:hidden">{formulario}</div>
          <div className="space-y-3">
            <p className="text-lg" style={tituloStyle}>
              Galeria
            </p>
            {galeria}
          </div>
          {rodape}
        </div>
      </div>,
    );
  }

  /* ---------------- 3. Diagonal ---------------- */
  if (m.hero === "diagonal") {
    return wrapper(
      <div>
        <div className="relative overflow-hidden">
          <Slider urls={fotos} aspect="aspect-[16/10] sm:aspect-[16/7]" radius={false} miniaturas={false} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(115deg, var(--lp-bg) 38%, transparent 62%)",
            }}
          />
          <div className="absolute inset-y-0 left-0 flex w-full max-w-xl items-center px-5 sm:px-10">
            <div className="space-y-4">
              {selo}
              <h1 className="text-4xl leading-[1.02] sm:text-6xl" style={tituloStyle}>
                {titulo}
              </h1>
              {viagem.subtitulo && (
                <p className="text-sm sm:text-base" style={{ color: "var(--lp-muted)" }}>
                  {viagem.subtitulo}
                </p>
              )}
              <div className="pt-1">{botaoAncora}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              {preco}
              {contagem}
            </div>
            {infos}
            {descricao}
            {inclusos}
            <div className="space-y-3">
              <p className="text-lg" style={tituloStyle}>Galeria</p>
              {galeria}
            </div>
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">{formulario}</div>
          <div className="lg:col-span-2">{rodape}</div>
        </div>
      </div>,
    );
  }

  /* ---------------- 4. Editorial — magazine ---------------- */
  if (m.hero === "magazine") {
    return wrapper(
      <div className="mx-auto max-w-5xl px-5 py-14">
        <p
          className="text-[10px] uppercase tracking-[0.4em]"
          style={{ color: "var(--lp-muted)" }}
        >
          Roteiro exclusivo · {viagem.destino}
        </p>
        <h1 className="mt-4 text-5xl leading-[1.03] sm:text-6xl" style={tituloStyle}>
          {titulo}
        </h1>
        <div
          className="mt-6 grid gap-6 border-y py-6 sm:grid-cols-[1.4fr_1fr]"
          style={{ borderColor: "var(--lp-border)" }}
        >
          {viagem.subtitulo ? (
            <p className="text-lg leading-relaxed" style={{ color: "var(--lp-muted)" }}>
              {viagem.subtitulo}
            </p>
          ) : (
            <span />
          )}
          <div className="sm:justify-self-end">{preco}</div>
        </div>

        <div className="mt-10">{galeria}</div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            {descricao}
            {inclusos}
          </div>
          <div className="space-y-8">
            {infos}
            {formulario}
          </div>
        </div>
        {rodape}
      </div>,
    );
  }

  /* ---------------- 5. Cartaz — poster ---------------- */
  if (m.hero === "poster") {
    return wrapper(
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">{selo}</div>
        <h1
          className="mt-4 text-[13vw] leading-[0.85] sm:text-[9vw]"
          style={tituloStyle}
        >
          {titulo}
        </h1>
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y py-4"
          style={{ borderColor: "var(--lp-border)" }}
        >
          <span
            className="text-[11px] uppercase tracking-[0.3em]"
            style={{ color: "var(--lp-muted)" }}
          >
            {viagem.subtitulo || viagem.destino}
          </span>
          {preco}
        </div>

        <div className="mt-8">
          <Slider urls={fotos} aspect="aspect-[16/9]" onAmpliar={(i) => setFotoAberta(i)} />
        </div>

        <div className="mt-8">{contagem}</div>
        <div className="mt-10 space-y-10">{corpo}</div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <p className="text-3xl leading-tight" style={tituloStyle}>
              Não fique de fora desta viagem.
            </p>
            <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
              As vagas são limitadas e as reservas seguem por ordem de chegada.
            </p>
            {botaoAncora}
          </div>
          {formulario}
        </div>
        {rodape}
      </div>,
    );
  }

  /* ---------------- 6. Bilhete — ticket ---------------- */
  if (m.hero === "ticket") {
    return wrapper(
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="overflow-hidden" style={{ ...caixa, boxShadow: "0 30px 60px -35px rgba(0,0,0,.5)" }}>
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
            style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em]">
              <Ticket className="h-4 w-4" /> Boarding pass · ELO
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.24em]">
              {formatarData(viagem.data_partida)}
            </span>
          </div>

          <Slider urls={fotos} aspect="aspect-[16/7]" radius={false} miniaturas={false} onAmpliar={(i) => setFotoAberta(i)} />

          <div className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.3em]"
                  style={{ color: "var(--lp-muted)" }}
                >
                  Destino
                </p>
                <h1 className="text-3xl sm:text-4xl" style={tituloStyle}>
                  {titulo}
                </h1>
              </div>
              {preco}
            </div>
            {viagem.subtitulo && (
              <p className="text-sm" style={{ color: "var(--lp-muted)" }}>
                {viagem.subtitulo}
              </p>
            )}
            {infos}
            <div
              className="border-t border-dashed pt-6"
              style={{ borderColor: "var(--lp-border)" }}
            >
              {contagem}
            </div>
            {descricao}
            {inclusos}
            <div className="space-y-3">
              <p className="text-lg" style={tituloStyle}>Galeria</p>
              {galeria}
            </div>
            {formulario}
          </div>
        </div>
        {rodape}
      </div>,
    );
  }

  /* ---------------- 7. Flutuante — cardfloat ---------------- */
  if (m.hero === "cardfloat") {
    return wrapper(
      <div style={{ background: "var(--lp-accent)" }} className="px-4 py-10 sm:py-16">
        <div className="mx-auto mb-8 max-w-3xl text-center" style={{ color: "var(--lp-accent-fg)" }}>
          <p className="text-[11px] uppercase tracking-[0.3em] opacity-80">
            {viagem.destino}
          </p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-6xl" style={{ ...tituloStyle, color: "var(--lp-accent-fg)" }}>
            {titulo}
          </h1>
          {viagem.subtitulo && (
            <p className="mx-auto mt-3 max-w-xl text-base opacity-85">{viagem.subtitulo}</p>
          )}
        </div>

        <div
          className="mx-auto max-w-4xl overflow-hidden"
          style={{
            background: "var(--lp-surface)",
            borderRadius: "var(--lp-radius)",
            boxShadow: "0 40px 80px -30px rgba(0,0,0,.5)",
            color: "var(--lp-fg)",
          }}
        >
          <div className="p-4 sm:p-6">
            <Slider urls={fotos} aspect="aspect-[16/9]" onAmpliar={(i) => setFotoAberta(i)} />
          </div>
          <div className="space-y-9 px-6 pb-8 sm:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {preco}
              {selo}
            </div>
            {corpo}
            {formulario}
          </div>
        </div>
        <div className="mx-auto max-w-4xl" style={{ color: "var(--lp-accent-fg)" }}>
          <footer className="mt-10 text-center text-[10px] uppercase tracking-[0.24em] opacity-80">
            ELO Transporte e Turismo
          </footer>
        </div>
      </div>,
    );
  }

  /* ---------------- 8. Sereno — centered ---------------- */
  if (m.hero === "centered") {
    return wrapper(
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p
          className="text-[10px] uppercase tracking-[0.35em]"
          style={{ color: "var(--lp-muted)" }}
        >
          {viagem.destino} · {formatarData(viagem.data_partida)}
        </p>
        <h1 className="mt-5 text-5xl leading-[1.05]" style={tituloStyle}>
          {titulo}
        </h1>
        {viagem.subtitulo && (
          <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "var(--lp-muted)" }}>
            {viagem.subtitulo}
          </p>
        )}
        <div className="mt-8 flex justify-center">{preco}</div>
        <div className="mt-10">
          <Slider urls={fotos} aspect="aspect-[3/2]" onAmpliar={(i) => setFotoAberta(i)} />
        </div>
        <div className="mt-12 space-y-10 text-left">
          {infos}
          {descricao}
          {inclusos}
        </div>
        <div className="mx-auto mt-12 max-w-md text-left">{formulario}</div>
        {rodape}
      </div>,
    );
  }

  /* ---------------- 9. Mosaico — collage ---------------- */
  if (m.hero === "collage") {
    const [f1, f2, f3] = [fotos[0], fotos[1] ?? fotos[0], fotos[2] ?? fotos[0]];
    return wrapper(
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Slider urls={fotos} aspect="aspect-[16/10]" miniaturas={false} onAmpliar={(i) => setFotoAberta(i)} />
          </div>
          <div className="grid gap-3">
            {[f2, f3].filter(Boolean).map((u, i) => (
              <img
                key={`${u}-${i}`}
                src={u}
                alt=""
                loading="lazy"
                onClick={() => setFotoAberta(fotos.indexOf(u))}
                className="aspect-[4/3] w-full cursor-zoom-in object-cover"
                style={{ borderRadius: "var(--lp-radius)" }}
              />
            ))}
            {!f1 && <div className="aspect-[4/3]" style={caixa} />}
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-9">
            {cabecalho}
            <div className="flex flex-wrap items-center justify-between gap-6">
              {preco}
              {contagem}
            </div>
            {infos}
            {descricao}
            {inclusos}
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">{formulario}</div>
          <div className="lg:col-span-2">{rodape}</div>
        </div>
      </div>,
    );
  }

  /* ---------------- 10. Expresso — banner ---------------- */
  if (m.hero === "banner") {
    return wrapper(
      <div>
        <div
          className="px-5 py-2 text-center text-[11px] font-bold uppercase tracking-[0.24em]"
          style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
        >
          Vagas limitadas · reserve hoje e garanta o valor promocional
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-5">
            <h1 className="text-4xl leading-[0.98] sm:text-6xl" style={tituloStyle}>
              {titulo}
            </h1>
            {viagem.subtitulo && (
              <p className="text-base" style={{ color: "var(--lp-muted)" }}>
                {viagem.subtitulo}
              </p>
            )}
            {infos}
            <div className="flex flex-wrap items-center gap-6">
              {preco}
              {contagem}
            </div>
          </div>
          <div>{formulario}</div>
        </div>

        <div className="mx-auto max-w-6xl space-y-10 px-5 pb-12">
          <Slider urls={fotos} aspect="aspect-[16/7]" onAmpliar={(i) => setFotoAberta(i)} />
          {descricao}
          {inclusos}
          <div className="flex justify-center">{botaoAncora}</div>
          {rodape}
        </div>
      </div>,
    );
  }

  /* ---------------- 11. Convite — framed ---------------- */
  if (m.hero === "framed") {
    return wrapper(
      <div className="px-4 py-10 sm:py-14">
        <div
          className="mx-auto max-w-4xl p-6 sm:p-12"
          style={{ border: "1px solid var(--lp-accent)" }}
        >
          <div
            className="p-6 sm:p-10"
            style={{ border: "1px solid var(--lp-border)" }}
          >
            <p
              className="text-center text-[10px] uppercase tracking-[0.4em]"
              style={{ color: "var(--lp-accent)" }}
            >
              Você está convidado
            </p>
            <h1 className="mt-5 text-center text-4xl leading-tight sm:text-5xl" style={tituloStyle}>
              {titulo}
            </h1>
            {viagem.subtitulo && (
              <p className="mx-auto mt-4 max-w-xl text-center text-sm" style={{ color: "var(--lp-muted)" }}>
                {viagem.subtitulo}
              </p>
            )}
            <div className="mt-8">
              <Slider urls={fotos} aspect="aspect-[3/2]" onAmpliar={(i) => setFotoAberta(i)} />
            </div>
            <div className="mt-10 flex justify-center">{preco}</div>
            <div className="mt-10 space-y-10">
              {infos}
              {descricao}
              {inclusos}
            </div>
            <div className="mx-auto mt-10 max-w-md">{formulario}</div>
          </div>
        </div>
        <div className="mx-auto max-w-4xl">{rodape}</div>
      </div>,
    );
  }

  /* ---------------- 12. Holofote — spotlight ---------------- */
  if (m.hero === "spotlight") {
    return wrapper(
      <div>
        <div className="relative">
          <Slider
            urls={fotos}
            aspect="aspect-[4/5] sm:aspect-[16/8]"
            radius={false}
            miniaturas={false}
            overlay={
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 35%, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.92) 100%)",
                }}
              />
            }
          />
          <div className="absolute inset-0 flex items-center justify-center px-5">
            <div className="max-w-2xl space-y-5 text-center text-white">
              {selo}
              <h1 className="text-4xl leading-[1.02] sm:text-6xl" style={{ ...tituloStyle, color: "#fff" }}>
                {titulo}
              </h1>
              {viagem.subtitulo && <p className="text-base opacity-90">{viagem.subtitulo}</p>}
              <div className="flex justify-center pt-2">{botaoAncora}</div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              {preco}
              {contagem}
            </div>
            {corpo}
            <div className="space-y-3">
              <p className="text-lg" style={tituloStyle}>Galeria</p>
              {galeria}
            </div>
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">{formulario}</div>
          <div className="lg:col-span-2">{rodape}</div>
        </div>
      </div>,
    );
  }

  /* ---------------- 13. Camadas — layered ---------------- */
  if (m.hero === "layered") {
    return wrapper(
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="relative">
          <div
            className="absolute -left-2 -top-2 hidden h-full w-full lg:block"
            style={{ background: "var(--lp-accent2)", borderRadius: "var(--lp-radius)", opacity: 0.35 }}
            aria-hidden
          />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <Slider urls={fotos} aspect="aspect-[4/3]" onAmpliar={(i) => setFotoAberta(i)} />
            <div
              className="space-y-5 self-center p-6 lg:-ml-16 lg:p-8"
              style={{ ...caixa, boxShadow: "0 30px 60px -35px rgba(0,0,0,.45)" }}
            >
              {cabecalho}
              {preco}
              <div>{botaoAncora}</div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-10">
            {infos}
            {descricao}
            {inclusos}
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">{formulario}</div>
        </div>
        {rodape}
      </div>,
    );
  }

  /* ---------------- 14. Stories ---------------- */
  if (m.hero === "story") {
    return wrapper(
      <div className="mx-auto max-w-md px-4 pb-28 pt-6">
        <div className="relative">
          <Slider
            urls={fotos}
            aspect="aspect-[9/16]"
            miniaturas={false}
            onAmpliar={(i) => setFotoAberta(i)}
            overlay={
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.85) 100%)",
                }}
              />
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-3 p-5 text-white">
            {selo}
            <h1 className="text-3xl leading-tight" style={{ ...tituloStyle, color: "#fff" }}>
              {titulo}
            </h1>
            {viagem.subtitulo && <p className="text-sm opacity-90">{viagem.subtitulo}</p>}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {preco}
          </div>
          {contagem}
          {infos}
          {descricao}
          {inclusos}
          {formulario}
          {rodape}
        </div>

        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t p-3"
          style={{ background: "var(--lp-surface)", borderColor: "var(--lp-border)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3">
            <span className="flex-1 leading-tight">
              <span className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--lp-muted)" }}>
                a partir de
              </span>
              <span className="block text-lg font-bold" style={{ color: "var(--lp-accent)" }}>
                {formatarValor(viagem.valor)}
              </span>
            </span>
            <a
              href="#reservar"
              className="flex h-11 flex-1 items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={ctaStyle(m)}
            >
              {m.ctaLabel}
            </a>
          </div>
        </div>
      </div>,
    );
  }

  /* ---------------- 15. Painel — grid ---------------- */
  return wrapper(
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {cabecalho}
          <Slider urls={fotos} aspect="aspect-[16/9]" onAmpliar={(i) => setFotoAberta(i)} />
        </div>
        <div className="space-y-4">
          <div className="space-y-5 p-5" style={caixa}>
            {preco}
            {contagem}
            <a
              href="#reservar"
              className="flex h-12 w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em]"
              style={ctaStyle(m)}
            >
              {m.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          {selo && <div className="flex">{selo}</div>}
        </div>
      </div>

      <div className="mt-10">{infos}</div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-10">
          {descricao}
          {inclusos}
        </div>
        <div>{formulario}</div>
      </div>
      {rodape}
    </div>,
  );
}
