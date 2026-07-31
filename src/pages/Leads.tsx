import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/lib/confirm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { useCrmData, type CrmLead } from "@/lib/crm";

const CORES_PIZZA = [
  "hsl(var(--primary))",
  "hsl(var(--brand-accent, var(--primary)))",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#64748b",
];


/** Formata um timestamp ISO completo em data e hora no padrão brasileiro. */
function formatarDataHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Módulo Leads — listagem completa dos contatos cadastrados no CRM. */
export default function Leads() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { confirm } = useConfirm();
  const { can, isAdmin } = useAuthz();
  const { stages, leads, loading, error, reload } = useCrmData();

  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("todas");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");

  const podeEditar = isAdmin || can("leads", "edit") || can("crm", "edit");
  const podeExcluir = isAdmin || can("leads", "delete") || can("crm", "delete");

  const origens = useMemo(
    () => Array.from(new Set(leads.map((l) => l.origem))).sort(),
    [leads],
  );

  const etapaPorId = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads
      .filter((l) => {
        const okTermo =
          !termo ||
          l.nome.toLowerCase().includes(termo) ||
          l.whatsapp.toLowerCase().includes(termo) ||
          l.origem.toLowerCase().includes(termo);
        const okEtapa = filtroEtapa === "todas" || l.stage_id === filtroEtapa;
        const okOrigem = filtroOrigem === "todas" || l.origem === filtroOrigem;
        return okTermo && okEtapa && okOrigem;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [leads, busca, filtroEtapa, filtroOrigem]);

  /** Evolução: quantidade de leads criados nos últimos 6 meses. */
  const evolucao = useMemo(() => {
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

  /** Distribuição de leads por origem. */
  const porOrigem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of leads) {
      const nome = l.origem || "Sem origem";
      mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
    }
    return Array.from(mapa, ([nome, total]) => ({ nome, total })).sort(
      (a, b) => b.total - a.total,
    );
  }, [leads]);



  async function excluirLead(lead: CrmLead) {
    if (!podeExcluir) return;
    const ok = await confirm({
      title: "Excluir lead",
      message: `Tem certeza que deseja excluir o lead "${lead.nome}"? Esta ação não poderá ser desfeita.`,
      confirmText: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const { error: err } = await supabase
        .from("crm_leads")
        .delete()
        .eq("id", lead.id);
      if (err) throw err;
      await reload();
      feedback.showSuccess("Lead excluído", `${lead.nome} foi removido.`);
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir o lead. Tente novamente.",
        err,
      );
    }
  }

  if (error) {
    return (
      <AppShell>
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Não foi possível carregar os leads. Verifique suas permissões e tente
          novamente.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · Leads
          </p>
          <h1 className="mt-2 font-serif text-2xl sm:text-3xl text-foreground">Leads</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {filtrados.length} de {leads.length} lead(s) cadastrado(s).
            <HelpTip texto="Lead é um contato interessado que ainda pode virar cliente. Aqui aparecem todos, em lista." />
          </p>
        </div>
        {podeEditar && (
          <HintButton
            hint="Cadastra um novo lead usando a mesma tela do CRM"
            className="w-full lg:w-auto"
            onClick={() => navigate("/leads/novo")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </HintButton>
        )}
      </div>

      {/* Mini dashboard (somente desktop) */}
      <div className="mb-6 hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-sm border border-border bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-primary-foreground">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] opacity-80">
            Total de leads
            <HelpTip texto="Quantidade total de leads já cadastrados no sistema." />
          </p>
          <p className="mt-3 font-serif text-5xl leading-none">{leads.length}</p>
          <div className="mt-4 flex items-center gap-4 text-xs opacity-90">
            <span>
              <strong className="text-base">
                {evolucao[evolucao.length - 1]?.total ?? 0}
              </strong>{" "}
              neste mês
            </span>
            <span>
              <strong className="text-base">{porOrigem.length}</strong> origem(ns)
            </span>
          </div>
          <Users className="pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 opacity-15" />
        </div>

        <div className="rounded-sm border border-border bg-background p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Últimos 6 meses
            <HelpTip texto="Mostra quantos leads entraram em cada um dos últimos 6 meses." />
          </p>
          <div className="mt-3 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                  }}
                  formatter={(v: number) => [`${v} lead(s)`, "Total"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={26}>
                  <LabelList
                    dataKey="total"
                    position="top"
                    fontSize={11}
                    fill="hsl(var(--muted-foreground))"
                  />
                  {evolucao.map((m, i) => (
                    <Cell key={m.chave} fill={CORES_BARRAS[i % CORES_BARRAS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-sm border border-border bg-background p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Origens
            <HelpTip texto="De quais canais os leads chegaram até você." />
          </p>
          <div className="mt-3 flex h-[150px] items-center gap-3">
            {porOrigem.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <>
                <div className="h-full w-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={porOrigem}
                        dataKey="total"
                        nameKey="nome"
                        innerRadius={34}
                        outerRadius={62}
                        paddingAngle={3}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {porOrigem.map((o, i) => (
                          <Cell key={o.nome} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                        formatter={(v: number, n: string) => [`${v} lead(s)`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 overflow-y-auto text-xs">
                  {porOrigem.slice(0, 6).map((o, i) => (
                    <li key={o.nome} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CORES_PIZZA[i % CORES_PIZZA.length] }}
                      />
                      <span className="truncate text-muted-foreground">{o.nome}</span>
                      <span className="ml-auto font-medium text-foreground">
                        {Math.round((o.total / leads.length) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>




      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 sm:max-w-sm sm:flex-1">
          <Input
            placeholder="Buscar por nome, WhatsApp ou origem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <HelpTip texto="Filtra a lista pelo nome, número de WhatsApp ou origem digitados" />
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
            <SelectTrigger className="sm:max-w-[200px]">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as etapas</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelpTip texto="Mostra apenas os leads que estão na etapa escolhida do funil" />
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="sm:max-w-[200px]">
              <SelectValue placeholder="Todas as origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              {origens.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelpTip texto="Mostra apenas os leads que chegaram pelo canal escolhido" />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-background p-10 text-center">
          <Users className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum lead encontrado com os filtros atuais.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-background">
          {filtrados.map((lead) => {
            const etapa = lead.stage_id ? etapaPorId.get(lead.stage_id) : null;
            return (
              <li
                key={lead.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {lead.nome}
                    </p>
                    {etapa && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ color: etapa.cor, borderColor: `${etapa.cor}55` }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: etapa.cor }}
                        />
                        {etapa.nome}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      {lead.origem}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{lead.whatsapp}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Cadastrado em {formatarDataHora(lead.created_at)}
                    </span>
                    {lead.viagens.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-brand-accent"
                        title={lead.viagens.map((v) => v.destino).join(", ")}
                      >
                        <MapPin className="h-3 w-3" />
                        {lead.viagens.length} viagem(ns) de interesse
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {podeEditar && (
                    <HintButton
                      hint="Abre a tela de cadastro para editar os dados deste lead"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </HintButton>
                  )}
                  {podeExcluir && (
                    <HintButton
                      hint="Exclui este lead permanentemente do sistema"
                      variant="outline"
                      size="sm"
                      className="h-9 text-destructive"
                      onClick={() => void excluirLead(lead)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </HintButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
