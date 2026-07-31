import { useMemo } from "react";
import {
  Activity,
  CalendarDays,
  Loader2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { UltimasVisitas } from "@/components/dashboard/ultimas-visitas";
import { HelpTip } from "@/components/help";
import { useCrmData, isStageFinal } from "@/lib/crm";
import { useVisitas } from "@/lib/visitas";


const CORES = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

/** Início do dia atual. */
function inicioDoDia(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function rotuloDia(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Cartão padrão do dashboard. */
function Card({
  titulo,
  ajuda,
  children,
  destaque = false,
  icone: Icone,
}: {
  titulo: string;
  ajuda: string;
  children: React.ReactNode;
  destaque?: boolean;
  icone?: typeof Users;
}) {
  return (
    <div
      className={
        destaque
          ? "relative overflow-hidden rounded-sm border border-border bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-primary-foreground"
          : "relative overflow-hidden rounded-sm border border-border bg-background p-5"
      }
    >
      <p
        className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] ${
          destaque ? "opacity-80" : "text-muted-foreground"
        }`}
      >
        {titulo}
        <HelpTip texto={ajuda} />
      </p>
      {children}
      {Icone && (
        <Icone className="pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 opacity-10" />
      )}
    </div>
  );
}

/** Bloco de gráfico com título e ajuda. */
function Painel({
  titulo,
  ajuda,
  children,
}: {
  titulo: string;
  ajuda: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border bg-background p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {titulo}
        <HelpTip texto={ajuda} />
      </p>
      <div className="mt-3 h-[220px]">{children}</div>
    </div>
  );
}

/** Módulo Dashboard — visão geral de visitas e leads. */
export default function Dashboard() {
  const { visitas, loading: carregandoVisitas } = useVisitas();
  const { stages, leads, loading: carregandoLeads } = useCrmData();

  const etapaPorId = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  /** Leads no dia, na semana e no mês. */
  const leadsPeriodo = useMemo(() => {
    const agora = new Date();
    const dia = inicioDoDia(agora);
    const semana = dia - 6 * 24 * 60 * 60 * 1000;
    const mes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
    let d = 0;
    let s = 0;
    let m = 0;
    for (const l of leads) {
      const t = new Date(l.created_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= dia) d += 1;
      if (t >= semana) s += 1;
      if (t >= mes) m += 1;
    }
    return { dia: d, semana: s, mes: m };
  }, [leads]);

  /** Evolução dos leads nos últimos 6 meses. */
  const evolucaoLeads = useMemo(() => {
    const base = new Date();
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (5 - i), 1);
      return {
        chave: `${d.getFullYear()}-${d.getMonth()}`,
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total: 0,
      };
    });
    const idx = new Map(meses.map((m, i) => [m.chave, i]));
    for (const l of leads) {
      const d = new Date(l.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) meses[i].total += 1;
    }
    return meses;
  }, [leads]);

  /** Previsão (tendência linear) dos próximos 6 meses de leads. */
  const previsao = useMemo(() => {
    const y = evolucaoLeads.map((m) => m.total);
    const n = y.length;
    const somaX = (n * (n - 1)) / 2;
    const somaY = y.reduce((a, b) => a + b, 0);
    const somaXY = y.reduce((acc, v, i) => acc + v * i, 0);
    const somaX2 = y.reduce((acc, _v, i) => acc + i * i, 0);
    const denom = n * somaX2 - somaX * somaX;
    const a = denom === 0 ? 0 : (n * somaXY - somaX * somaY) / denom;
    const b = (somaY - a * somaX) / n;

    const base = new Date();
    const historico = evolucaoLeads.map((m) => ({
      mes: m.mes,
      real: m.total as number | null,
      previsto: null as number | null,
    }));
    if (historico.length) {
      historico[historico.length - 1].previsto =
        historico[historico.length - 1].real;
    }
    const futuro = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i + 1, 1);
      const valor = Math.max(0, Math.round(a * (n + i) + b));
      return {
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        real: null as number | null,
        previsto: valor,
      };
    });
    return [...historico, ...futuro];
  }, [evolucaoLeads]);

  /** Leads por etapa em andamento (não finalizadas). */
  const porEtapa = useMemo(() => {
    const mapa = new Map<string, { nome: string; cor: string; total: number }>();
    for (const l of leads) {
      const etapa = l.stage_id ? etapaPorId.get(l.stage_id) : null;
      if (!etapa || isStageFinal(etapa)) continue;
      const atual = mapa.get(etapa.id) ?? {
        nome: etapa.nome,
        cor: etapa.cor,
        total: 0,
      };
      atual.total += 1;
      mapa.set(etapa.id, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [leads, etapaPorId]);

  /** Leads fechados x perdidos. */
  const fechadoPerdido = useMemo(() => {
    let fechado = 0;
    let perdido = 0;
    for (const l of leads) {
      const etapa = l.stage_id ? etapaPorId.get(l.stage_id) : null;
      if (!etapa || !isStageFinal(etapa)) continue;
      const nome = etapa.nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (nome.includes("perdido")) perdido += 1;
      else fechado += 1;
    }
    return [
      { nome: "Fechado", total: fechado, cor: "#10b981" },
      { nome: "Perdido", total: perdido, cor: "#ef4444" },
    ];
  }, [leads, etapaPorId]);

  const semana = useMemo(
    () =>
      (visitas.semana ?? []).map((d) => ({
        dia: rotuloDia(d.dia),
        unica: Number(d.unica) || 0,
        total: Number(d.total) || 0,
      })),
    [visitas.semana],
  );

  const carregando = carregandoVisitas && carregandoLeads;

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--background))",
  };

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Módulo · Dashboard
        </p>
        <h1 className="mt-2 font-serif text-2xl sm:text-3xl text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          Visão geral das visitas nas páginas públicas e dos leads.
          <HelpTip texto="Visita é quando alguém abre uma página pública (landing page). Única = pessoas diferentes; Total = todas as aberturas." />
        </p>
      </div>

      {carregando ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* LINHA 1 — cartões */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              titulo="Online agora"
              ajuda="Pessoas diferentes que abriram uma página pública nos últimos 3 minutos."
              destaque
              icone={Activity}
            >
              <p className="mt-3 font-serif text-5xl leading-none">
                {visitas.online}
              </p>
              <p className="mt-4 text-xs opacity-90">últimos 3 minutos</p>
            </Card>

            <Card
              titulo="Visitas hoje"
              ajuda="Quantas pessoas diferentes (única) e quantas aberturas no total aconteceram hoje."
              icone={Users}
            >
              <p className="mt-3 font-serif text-4xl leading-none text-foreground">
                {visitas.dia_unica}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                única · <strong className="text-foreground">{visitas.dia_total}</strong>{" "}
                no total
              </p>
            </Card>

            <Card
              titulo="Visitas no mês"
              ajuda="Pessoas diferentes (única) e total de aberturas desde o dia 1º deste mês."
              icone={CalendarDays}
            >
              <p className="mt-3 font-serif text-4xl leading-none text-foreground">
                {visitas.mes_unica}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                única · <strong className="text-foreground">{visitas.mes_total}</strong>{" "}
                no total
              </p>
            </Card>

            <Card
              titulo="Leads"
              ajuda="Quantidade de leads cadastrados hoje, nos últimos 7 dias e neste mês."
              icone={UserPlus}
            >
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { r: "Hoje", v: leadsPeriodo.dia },
                  { r: "Semana", v: leadsPeriodo.semana },
                  { r: "Mês", v: leadsPeriodo.mes },
                ].map((x) => (
                  <div key={x.r}>
                    <p className="font-serif text-3xl leading-none text-foreground">
                      {x.v}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {x.r}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* LINHA 2 — evolução */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Painel
              titulo="Visitas nos últimos 7 dias"
              ajuda="Comparação diária entre pessoas diferentes (única) e o total de aberturas."
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={semana} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gUnica" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area name="Total" type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#gTotal)" />
                  <Area name="Única" type="monotone" dataKey="unica" stroke="#10b981" strokeWidth={2} fill="url(#gUnica)" />
                </AreaChart>
              </ResponsiveContainer>
            </Painel>

            <Painel
              titulo="Evolução de leads (6 meses)"
              ajuda="Quantos leads entraram em cada um dos últimos 6 meses."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucaoLeads} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} lead(s)`, "Total"]}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={30}>
                    <LabelList dataKey="total" position="top" fontSize={11} fill="hsl(var(--muted-foreground))" />
                    {evolucaoLeads.map((m, i) => (
                      <Cell key={m.chave} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Painel>
          </div>

          {/* LINHA 3 — distribuição e previsão */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Painel
              titulo="Leads por etapa"
              ajuda="Como estão distribuídos os leads que ainda estão em negociação no funil."
            >
              {porEtapa.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porEtapa}
                      dataKey="total"
                      nameKey="nome"
                      innerRadius={44}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {porEtapa.map((e, i) => (
                        <Cell key={e.nome} fill={e.cor || CORES[i % CORES.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v} lead(s)`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Painel>

            <Painel
              titulo="Fechado x Perdido"
              ajuda="Proporção entre os leads que viraram venda e os que foram perdidos."
            >
              {fechadoPerdido.every((f) => f.total === 0) ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sem dados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fechadoPerdido}
                      dataKey="total"
                      nameKey="nome"
                      innerRadius={44}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {fechadoPerdido.map((f) => (
                        <Cell key={f.nome} fill={f.cor} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v} lead(s)`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Painel>

            <Painel
              titulo="Previsão dos próximos 6 meses"
              ajuda="Estimativa de leads futuros calculada pela tendência dos últimos 6 meses. É apenas uma projeção."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={previsao} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line name="Realizado" type="monotone" dataKey="real" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line name="Previsto" type="monotone" dataKey="previsto" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Painel>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Os números de visitas são atualizados automaticamente a cada 30
            segundos.
          </p>
        </div>
      )}
    </AppShell>
  );
}
