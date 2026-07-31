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
