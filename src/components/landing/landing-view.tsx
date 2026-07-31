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
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Navigation,
  Plane,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Users,
  X,
} from "lucide-react";

import { getLandingModel, type LandingModel } from "@/lib/landing-models";
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
  uf: string | null;
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
  onSubmit?: (dados: { nome: string; whatsapp: string }) => Promise<string | null>;
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
/* Animação de entrada ao rolar a página                               */
/* ------------------------------------------------------------------ */

function useRevealOnScroll(deps: unknown[] = []) {
  const raiz = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const no = raiz.current;
    if (!no) return;
    const alvos = Array.from(no.querySelectorAll<HTMLElement>(".lp-reveal"));
    if (typeof IntersectionObserver === "undefined") {
      alvos.forEach((a) => a.classList.add("lp-in"));
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("lp-in");
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    alvos.forEach((a) => obs.observe(a));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return raiz;
}

/* ------------------------------------------------------------------ */
/* Ícones por modelo                                                   */
/* ------------------------------------------------------------------ */

const ICONES = {
  classico: { destino: MapPin, data: CalendarDays, hora: Clock, vagas: Users, marca: Star },
  viagem: { destino: Plane, data: CalendarDays, hora: Timer, vagas: Users, marca: Compass },
  bussola: { destino: Navigation, data: CalendarDays, hora: Clock, vagas: Users, marca: Anchor },
} as const;

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

function themeVars(m: LandingModel, p: LandingPalette): CSSProperties {
  return {
    ["--lp-bg" as string]: p.bg,
    ["--lp-bg2" as string]: p.bg2,
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
    ["--lp-shadow" as string]: p.escura
      ? "0 18px 50px -24px rgba(0,0,0,.85)"
      : "0 18px 45px -26px rgba(15,23,42,.32)",
    fontFamily: "var(--lp-body)",
  };
}

/* Tipografia fluida: cresce no celular, sem exagerar no computador. */
const T = {
  h1: "clamp(2rem, 6.2vw, 3.25rem)",
  h2: "clamp(1.375rem, 3.4vw, 1.875rem)",
  h3: "clamp(1.05rem, 2.2vw, 1.25rem)",
  corpo: "clamp(1rem, 1.5vw, 1.0625rem)",
  pequeno: "clamp(0.875rem, 1.2vw, 0.9375rem)",
  preco: "clamp(2rem, 5vw, 2.75rem)",
} as const;

/* ------------------------------------------------------------------ */
/* Galeria em slider                                                   */
/* ------------------------------------------------------------------ */

function Slider({
  urls,
  aspect = "aspect-[4/5] sm:aspect-[4/3]",
  radius = true,
  className,
  overlay,
  onAmpliar,
  miniaturas = true,
  kenburns = false,
}: {
  urls: string[];
  aspect?: string;
  radius?: boolean;
  className?: string;
  overlay?: ReactNode;
  onAmpliar?: (i: number) => void;
  miniaturas?: boolean;
  kenburns?: boolean;
}) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = urls.length;
  const timer = useRef<number | null>(null);
  const toqueX = useRef<number | null>(null);

  useEffect(() => {
    if (total < 2 || pausado) return;
    timer.current = window.setInterval(() => setI((v) => (v + 1) % total), 5500);
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
        className={`${aspect} grid w-full place-items-center ${className ?? ""}`}
        style={{
          background: "var(--lp-bg2)",
          borderRadius: radius ? "var(--lp-radius)" : undefined,
          color: "var(--lp-muted)",
        }}
      >
        <ImageIcon className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  const ir = (novo: number) => setI(((novo % total) + total) % total);

  return (
    <div className={className}>
      <div
        className={`lp-slider relative w-full overflow-hidden ${aspect}`}
        style={{
          borderRadius: radius ? "var(--lp-radius)" : undefined,
          boxShadow: radius ? "var(--lp-shadow)" : undefined,
        }}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onTouchStart={(e) => {
          toqueX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const inicio = toqueX.current;
          const fim = e.changedTouches[0]?.clientX ?? null;
          if (inicio == null || fim == null) return;
          if (Math.abs(fim - inicio) > 45) ir(fim < inicio ? i + 1 : i - 1);
          toqueX.current = null;
        }}
      >
        {urls.map((url, idx) => (
          <img
            key={url + idx}
            src={url}
            alt=""
            loading={idx === 0 ? "eager" : "lazy"}
            onClick={() => onAmpliar?.(idx)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out ${
              idx === i ? "opacity-100 scale-100" : "opacity-0 scale-[1.04]"
            } ${kenburns && idx === i ? "lp-kenburns" : ""} ${
              onAmpliar ? "cursor-zoom-in" : ""
            }`}
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
              className="absolute left-2.5 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 sm:grid"
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
              className="absolute right-2.5 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 sm:grid"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
              {urls.map((u, idx) => (
                <button
                  key={`dot-${u}-${idx}`}
                  type="button"
                  aria-label={`Ir para a foto ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    ir(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === i ? "w-6 bg-white" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {miniaturas && total > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {urls.map((url, idx) => (
            <button
              key={`thumb-${url}-${idx}`}
              type="button"
              onClick={() => ir(idx)}
              aria-label={`Ver foto ${idx + 1}`}
              className="aspect-[3/2] h-auto w-full overflow-hidden transition duration-300 hover:opacity-100"
              style={{
                borderRadius: "calc(var(--lp-radius) * 0.6)",
                outline:
                  idx === i ? "2px solid var(--lp-accent)" : "1px solid var(--lp-border)",
                outlineOffset: "1px",
                opacity: idx === i ? 1 : 0.6,
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
      className="lp-fade fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <button
        type="button"
        aria-label="Fechar galeria"
        onClick={onFechar}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
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
            className="absolute left-3 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
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
            className="absolute right-3 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <img
        src={urls[indice]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[82vh] max-w-full rounded-lg object-contain"
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

function Countdown({
  data,
  hora,
  claro = false,
}: {
  data: string;
  hora: string | null;
  claro?: boolean;
}) {
  const alvo = useMemo(
    () => new Date(`${data}T${(hora || "00:00").slice(0, 5)}:00`).getTime(),
    [data, hora],
  );
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!alvo || Number.isNaN(alvo)) return null;
  const restante = Math.max(0, alvo - agora);

  const partes = [
    { v: Math.floor(restante / 86400000), l: "dias" },
    { v: Math.floor((restante % 86400000) / 3600000), l: "horas" },
    { v: Math.floor((restante % 3600000) / 60000), l: "min" },
    { v: Math.floor((restante % 60000) / 1000), l: "seg" },
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {partes.map((p) => (
        <div
          key={p.l}
          className="min-w-[3.25rem] flex-1 px-1.5 py-2 text-center sm:min-w-[3.75rem] sm:flex-none"
          style={{
            background: claro ? "rgba(255,255,255,.14)" : "var(--lp-surface)",
            border: `1px solid ${claro ? "rgba(255,255,255,.24)" : "var(--lp-border)"}`,
            borderRadius: "calc(var(--lp-radius) * 0.7)",
            backdropFilter: claro ? "blur(6px)" : undefined,
          }}
        >
          <span
            className="block text-lg font-bold leading-none tabular-nums sm:text-xl"
            style={{ color: claro ? "#fff" : "var(--lp-accent)" }}
          >
            {String(p.v).padStart(2, "0")}
          </span>
          <span
            className="mt-1 block text-[9px] uppercase tracking-[0.16em]"
            style={{ color: claro ? "rgba(255,255,255,.75)" : "var(--lp-muted)" }}
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
  const base: CSSProperties = { borderRadius: "calc(var(--lp-radius) * 0.75)" };
  if (m.cta === "gradiente")
    return {
      ...base,
      background: "linear-gradient(100deg, var(--lp-accent), var(--lp-accent2))",
      color: "var(--lp-accent-fg)",
      boxShadow: "0 14px 30px -14px var(--lp-accent)",
    };
  if (m.cta === "brilho")
    return {
      ...base,
      background: "var(--lp-accent)",
      color: "var(--lp-accent-fg)",
      boxShadow: "0 16px 38px -12px var(--lp-accent)",
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
  compacto = false,
  ancora = true,
}: {
  m: LandingModel;
  onSubmit?: Props["onSubmit"];
  whatsappUrl?: Props["whatsappUrl"];
  preview?: boolean;
  compacto?: boolean;
  /** Só um formulário na página deve carregar a âncora #reservar. */
  ancora?: boolean;
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
    borderRadius: "calc(var(--lp-radius) * 0.7)",
    color: "var(--lp-fg)",
  };

  const caixa: CSSProperties = {
    border: "1px solid var(--lp-border)",
    borderRadius: "var(--lp-radius)",
    background: "var(--lp-surface)",
    boxShadow: "var(--lp-shadow)",
  };

  if (ok) {
    return (
      <div className="lp-pop p-6 text-center sm:p-7" style={caixa} id={ancora ? "reservar" : undefined}>
        <span
          className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full"
          style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
        >
          <Check className="h-6 w-6" />
        </span>
        <p className="text-lg font-semibold" style={{ fontFamily: "var(--lp-title)" }}>
          Recebemos o seu contato!
        </p>
        <p className="mt-1.5" style={{ color: "var(--lp-muted)", fontSize: T.pequeno }}>
          {linkWhats
            ? "Estamos abrindo o WhatsApp para você falar com a agência."
            : "Em breve nossa equipe fala com você no WhatsApp."}
        </p>
        {linkWhats && (
          <a
            href={linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            className="lp-cta mt-5 flex h-13 w-full items-center justify-center gap-2 py-3.5 text-sm font-bold transition"
            style={ctaStyle(m)}
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Abrir o WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      id={ancora ? "reservar" : undefined}
      className={compacto ? "space-y-3 p-5" : "space-y-3.5 p-5 sm:p-6"}
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
      <div className="space-y-1">
        <p
          className="font-semibold leading-tight"
          style={{ fontFamily: "var(--lp-title)", fontSize: T.h3 }}
        >
          Receba o roteiro completo
        </p>
        <p style={{ color: "var(--lp-muted)", fontSize: T.pequeno }}>
          Preencha e um consultor fala com você agora pelo WhatsApp.
        </p>
      </div>

      <input
        required
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        aria-label="Seu nome"
        className="lp-input h-12 w-full px-3.5 text-base outline-none transition sm:h-11 sm:text-[0.95rem]"
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
        className="lp-input h-12 w-full px-3.5 text-base outline-none transition sm:h-11 sm:text-[0.95rem]"
        style={inputStyle}
      />

      {erro && (
        <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="lp-cta flex w-full items-center justify-center gap-2 py-4 text-sm font-bold transition disabled:opacity-60 sm:py-3.5"
        style={ctaStyle(m)}
      >
        <Send className="h-4 w-4" />
        {enviando ? "Enviando..." : m.ctaLabel}
      </button>
      <p
        className="flex items-center justify-center gap-1.5 text-center text-xs"
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
  const m = useMemo(() => getLandingModel(modelo ?? viagem.modelo), [modelo, viagem.modelo]);
  const p = useMemo(
    () => getLandingPalette(paleta ?? viagem.paleta ?? m.paletaPadrao),
    [paleta, viagem.paleta, m.paletaPadrao],
  );
  useGoogleFont(m.fonts.google);

  const imagens = viagem.imagens ?? [];
  const capa = capaDa(imagens);
  const fotos = Array.from(
    new Set([capa, ...imagens.map((i) => i.url)].filter((u): u is string => !!u)),
  );
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  const [formularioVisivel, setFormularioVisivel] = useState(false);
  const itens = viagem.itens_inclusos ?? [];
  const titulo = viagem.titulo?.trim() || viagem.destino;
  const Ico = ICONES[m.icones];
  const raiz = useRevealOnScroll([m.key, p.key, viagem.id]);

  useEffect(() => {
    const el = document.getElementById("reservar");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setFormularioVisivel(entry.isIntersecting),
      { rootMargin: "0px 0px -80px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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

  const secao = "mx-auto w-full max-w-6xl px-4 sm:px-6";

  /* ------------------------- blocos ------------------------- */

  const dadosInfo = [
    { icon: <Ico.destino className="h-4.5 w-4.5" />, label: "Destino", value: viagem.destino },
    { icon: <Ico.data className="h-4.5 w-4.5" />, label: "Partida", value: formatarData(viagem.data_partida) },
    { icon: <Ico.hora className="h-4.5 w-4.5" />, label: "Horário", value: formatarHora(viagem.hora_partida) },
    { icon: <Ico.vagas className="h-4.5 w-4.5" />, label: "Vagas", value: `${viagem.vagas || 0} lugares` },
  ];

  const infos = (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {dadosInfo.map((d, i) => (
        <div
          key={d.label}
          className="lp-reveal lp-card flex items-center gap-3 p-3.5"
          style={{ ...caixa, transitionDelay: `${i * 60}ms` }}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--lp-bg2)", color: "var(--lp-accent)" }}
          >
            {d.icon}
          </span>
          <span className="min-w-0 leading-tight">
            <span
              className="block text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--lp-muted)" }}
            >
              {d.label}
            </span>
            <span className="block truncate text-sm font-semibold">{d.value}</span>
          </span>
        </div>
      ))}
    </div>
  );

  const selo = (
    <span
      className="lp-pulse inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
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

  const dataPill = (claro = false) => (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
      style={{
        border: `1px solid ${claro ? "rgba(255,255,255,.35)" : "var(--lp-border)"}`,
        color: claro ? "#fff" : "var(--lp-accent)",
        background: claro ? "rgba(255,255,255,.12)" : "transparent",
        borderRadius: "999px",
        backdropFilter: claro ? "blur(6px)" : undefined,
      }}
    >
      <Ico.marca className="h-3.5 w-3.5" />
      {formatarData(viagem.data_partida)}
    </span>
  );

  const preco = (
    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
      <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
        a partir de
      </span>
      <span
        className="leading-none"
        style={{ ...tituloStyle, color: "var(--lp-accent)", fontSize: T.preco }}
      >
        {formatarValor(viagem.valor)}
      </span>
      <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
        por pessoa
      </span>
    </div>
  );

  const contagem = (claro = false) => (
    <div className="space-y-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: claro ? "rgba(255,255,255,.8)" : "var(--lp-muted)" }}
      >
        A viagem começa em
      </p>
      <Countdown data={viagem.data_partida} hora={viagem.hora_partida} claro={claro} />
    </div>
  );

  const botaoAncora = (largo = false) => (
    <a
      href="#reservar"
      className={`lp-cta inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold transition sm:py-3.5 ${
        largo ? "w-full sm:w-auto" : ""
      }`}
      style={ctaStyle(m)}
    >
      {m.ctaLabel}
      <ArrowRight className="h-4 w-4" />
    </a>
  );

  const confianca = (
    <div
      className="flex flex-wrap justify-center gap-2 px-4 sm:gap-2.5 sm:px-6"
      aria-label="Diferenciais da agência"
    >
      {[
        { i: <BadgeCheck className="h-4 w-4" />, t: "Agência credenciada" },
        { i: <ShieldCheck className="h-4 w-4" />, t: "Pagamento seguro" },
        { i: <Users className="h-4 w-4" />, t: "Grupos acompanhados" },
        { i: <Heart className="h-4 w-4" />, t: "+2 mil viajantes" },
      ].map((b) => (
        <span
          key={b.t}
          className="inline-flex shrink-0 items-center gap-2 px-3.5 py-2 text-xs font-medium"
          style={{
            border: "1px solid var(--lp-border)",
            background: "var(--lp-surface)",
            borderRadius: "999px",
            color: "var(--lp-muted)",
          }}
        >
          <span style={{ color: "var(--lp-accent)" }}>{b.i}</span>
          {b.t}
        </span>
      ))}
    </div>
  );

  const descricao = viagem.descricao && (
    <div className="lp-reveal">
      <p className="mb-3 leading-tight" style={{ ...tituloStyle, fontSize: T.h2 }}>
        Sobre a viagem
      </p>
      <p
        className="max-w-3xl whitespace-pre-line leading-relaxed"
        style={{ color: "var(--lp-muted)", fontSize: T.corpo }}
      >
        {viagem.descricao}
      </p>
    </div>
  );

  const inclusos = itens.length > 0 && (
    <div className="lp-reveal">
      <p className="mb-1 leading-tight" style={{ ...tituloStyle, fontSize: T.h2 }}>
        Tudo isso já está incluso
      </p>
      <p className="mb-4" style={{ color: "var(--lp-muted)", fontSize: T.pequeno }}>
        Sem surpresas: o que você vê aqui já está no valor.
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {itens.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className="lp-card flex items-start gap-2.5 p-3.5"
            style={{ ...caixa, fontSize: T.pequeno }}
          >
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}
            >
              <Check className="h-3 w-3" />
            </span>
            <span className="font-medium">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const galeriaSecao = fotos.length > 0 && (
    <div className="lp-reveal">
      <p className="mb-3 leading-tight" style={{ ...tituloStyle, fontSize: T.h2 }}>
        A viagem por dentro
      </p>
      <Slider urls={fotos} onAmpliar={(i) => setFotoAberta(i)} />
    </div>
  );

  const ofertaCard = (
    <div
      className="lp-reveal overflow-hidden"
      style={{ ...caixa, boxShadow: "var(--lp-shadow)" }}
    >
      <div
        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        style={{ background: "var(--lp-bg2)" }}
      >
        <div className="space-y-2">
          {selo}
          {preco}
        </div>
        <div className="sm:text-right">{botaoAncora()}</div>
      </div>
    </div>
  );

  const formulario = (
    <Formulario m={m} onSubmit={onSubmit} whatsappUrl={whatsappUrl} preview={preview} />
  );

  const depoimentos = (
    <div className="lp-reveal grid gap-3 sm:grid-cols-3">
      {[
        { n: "Ana Paula", t: "Organização impecável do início ao fim. Já quero a próxima!" },
        { n: "Marcos R.", t: "Ônibus confortável, guias atenciosos e roteiro muito bem pensado." },
        { n: "Juliana M.", t: "Melhor custo-benefício que já encontrei. Recomendo demais." },
      ].map((d) => (
        <figure key={d.n} className="lp-card p-4" style={caixa}>
          <div className="mb-2 flex gap-0.5" style={{ color: "var(--lp-accent)" }}>
            {[0, 1, 2, 3, 4].map((s) => (
              <Star key={s} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
          <blockquote style={{ fontSize: T.pequeno }}>“{d.t}”</blockquote>
          <figcaption className="mt-2 text-xs font-semibold" style={{ color: "var(--lp-muted)" }}>
            {d.n}
          </figcaption>
        </figure>
      ))}
    </div>
  );

  const rodape = (
    <footer
      className="mt-14 border-t pt-6 text-center text-[10px] uppercase tracking-[0.24em]"
      style={{ borderColor: "var(--lp-border)", color: "var(--lp-muted)" }}
    >
      ELO Transporte e Turismo
    </footer>
  );

  /** Barra fixa de ação no celular. */
  const barraMobile = (
    <div
      className={`lp-barra fixed inset-x-0 bottom-0 z-[90] flex items-center gap-3 border-t px-4 py-3 transition-transform duration-300 ease-out will-change-transform lg:hidden ${
        formularioVisivel ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
      style={{
        background: "var(--lp-surface)",
        borderColor: "var(--lp-border)",
        boxShadow: "0 -10px 30px -18px rgba(0,0,0,.45)",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="min-w-0 leading-tight">
        <span className="block text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--lp-muted)" }}>
          a partir de
        </span>
        <span className="block text-lg font-bold" style={{ color: "var(--lp-accent)" }}>
          {formatarValor(viagem.valor)}
        </span>
      </div>
      <a
        href="#reservar"
        className="lp-cta ml-auto flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-bold"
        style={ctaStyle(m)}
      >
        <MessageCircle className="h-4 w-4" />
        Quero minha vaga
      </a>
    </div>
  );

  /** Conteúdo comum abaixo do topo. */
  const corpoComum = (
    <div className="space-y-12 sm:space-y-14">
      {descricao}
      {inclusos}
      {depoimentos}
      {galeriaSecao}
    </div>
  );

  /** Formulário flutuante (desktop): acompanha a rolagem sem cobrir o conteúdo.
   *  Alinhado à borda direita do container centralizado (--app-max-width). */
  const formularioFlutuante = (
    <aside
      className="pointer-events-none fixed inset-y-0 z-[80] hidden w-[24rem] items-center px-5 lg:flex"
      aria-label="Formulário de contato"
      style={{
        right: "calc((100vw - min(100vw, var(--app-max-width, 1280px))) / 2)",
      }}
    >
      <div className="lp-flutuante pointer-events-auto max-h-[92vh] w-full overflow-y-auto">
        <Formulario
          m={m}
          onSubmit={onSubmit}
          whatsappUrl={whatsappUrl}
          preview={preview}
          compacto
          ancora={false}
        />
      </div>
    </aside>
  );

  const wrapper = (children: ReactNode) => (
    <div
      ref={raiz}
      className="lp-root min-h-full w-full pb-24 lg:pb-0 lg:pr-[24rem]"
      style={{ ...themeVars(m, p), background: "var(--lp-bg)", color: "var(--lp-fg)" }}
    >
      {children}
      {formularioFlutuante}
      {barraMobile}
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

  /* ---------------- 1. Aurora — editorial ---------------- */
  if (m.hero === "editorial") {
    return wrapper(
      <>
        <header className={`${secao} pt-6 sm:pt-10`}>
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-12">
            <div className="lp-reveal order-1 space-y-4 lg:order-none">
              <div className="flex flex-wrap items-center gap-2">
                {dataPill()}
                {selo}
              </div>
              <h1 className="leading-[1.05]" style={{ ...tituloStyle, fontSize: T.h1 }}>
                {titulo}
              </h1>
              {viagem.subtitulo && (
                <p
                  className="max-w-xl leading-relaxed"
                  style={{ color: "var(--lp-muted)", fontSize: T.corpo }}
                >
                  {viagem.subtitulo}
                </p>
              )}
              <div className="pt-1">{preco}</div>
              <div className="lp-reveal">{contagem()}</div>
            </div>


            <div className="lp-reveal order-0 lg:order-none lg:sticky lg:top-6">
              <Slider urls={fotos} onAmpliar={(i) => setFotoAberta(i)} kenburns />
            </div>
          </div>
        </header>

        <div className="py-7 sm:py-9">{confianca}</div>

        <main className={`${secao} space-y-12 sm:space-y-14`}>
          {infos}
          {corpoComum}
          <div className="lg:hidden">{formulario}</div>
          {rodape}
        </main>
      </>,
    );
  }

  /* ---------------- 2. Impacto — imersivo ---------------- */
  if (m.hero === "imersivo") {
    return wrapper(
      <>
        <header className="relative">
          <Slider
            urls={fotos}
            aspect="aspect-[3/4] sm:aspect-[16/9] lg:aspect-[21/9]"
            radius={false}
            miniaturas={false}
            kenburns
            overlay={
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 30%, rgba(0,0,0,.75) 78%, rgba(0,0,0,.92) 100%)",
                }}
              />
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div
              className={`${secao} pointer-events-auto grid gap-7 pb-7 sm:pb-9`}
            >
              <div className="lp-rise space-y-3.5 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  {dataPill(true)}
                  {selo}
                </div>
                <h1
                  className="leading-[1.02]"
                  style={{ ...tituloStyle, color: "#fff", fontSize: T.h1 }}
                >
                  {titulo}
                </h1>
                {viagem.subtitulo && (
                  <p className="max-w-xl leading-relaxed opacity-90" style={{ fontSize: T.corpo }}>
                    {viagem.subtitulo}
                  </p>
                )}
                <div className="pt-1">{contagem(true)}</div>
              </div>
              
            </div>
          </div>
        </header>

        <div className="py-7 sm:py-9">{confianca}</div>

        <main className={`${secao} space-y-12 sm:space-y-14`}>
          {ofertaCard}
          {infos}
          {corpoComum}
          <div className="mx-auto max-w-lg lg:hidden">{formulario}</div>
          {rodape}
        </main>
      </>,
    );
  }

  /* ---------------- 3. Vitrine — cartão flutuante ---------------- */
  return wrapper(
    <>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-b-[2rem] pb-24 pt-8 sm:pb-28 sm:pt-12"
          style={{
            background: "linear-gradient(150deg, var(--lp-accent), var(--lp-accent2))",
          }}
        >
          <div className="lp-rise space-y-3.5 px-4 text-center sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {dataPill(true)}
          </div>
          <h1
            className="mx-auto max-w-3xl leading-[1.05]"
            style={{ ...tituloStyle, color: "var(--lp-accent-fg)", fontSize: T.h1 }}
          >
            {titulo}
          </h1>
          {viagem.subtitulo && (
            <p
              className="mx-auto max-w-xl leading-relaxed opacity-90"
              style={{ color: "var(--lp-accent-fg)", fontSize: T.corpo }}
            >
              {viagem.subtitulo}
            </p>
          )}
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--lp-accent-fg)", opacity: 0.85 }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Saída garantida — vagas limitadas
          </p>
          </div>
        </div>
      </div>

      <main className={`${secao} -mt-16 space-y-12 sm:-mt-20 sm:space-y-14`}>
        <div
          className="lp-pop overflow-hidden"
          style={{ ...caixa, boxShadow: "var(--lp-shadow)" }}
        >
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.1fr_.9fr] lg:gap-8">
            <Slider urls={fotos} onAmpliar={(i) => setFotoAberta(i)} kenburns />
            <div className="space-y-5">
              {selo}
              {preco}
              {contagem()}
              <div className="lg:hidden">
                <Formulario
                  m={m}
                  onSubmit={onSubmit}
                  whatsappUrl={whatsappUrl}
                  preview={preview}
                  compacto
                />
              </div>
            </div>
          </div>
        </div>

        {confianca}
        {infos}
        {corpoComum}
        {rodape}
      </main>
    </>,
  );
}
