import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  Layers,
  MessageCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn } from "@/lib/utils";
import {
  useCrmData,
  whatsappLink,
  type CrmLead,
  type CrmStage,
} from "@/lib/crm";

export default function Crm() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { can, isAdmin } = useAuthz();
  const { stages, leads, loading, error, reload } = useCrmData();
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");
  const [movendo, setMovendo] = useState<string | null>(null);

  const podeEditar = isAdmin || can("crm", "edit");
  const podeExcluir = isAdmin || can("crm", "delete");

  const etapasAtivas = useMemo(
    () => stages.filter((s) => s.ativo),
    [stages],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((l) => {
      const okTermo =
        !termo ||
        l.nome.toLowerCase().includes(termo) ||
        l.whatsapp.toLowerCase().includes(termo) ||
        l.origem.toLowerCase().includes(termo);
      const okEtapa = filtroEtapa === "todas" || l.stage_id === filtroEtapa;
      return okTermo && okEtapa;
    });
  }, [leads, busca, filtroEtapa]);

  function leadsDaEtapa(stageId: string): CrmLead[] {
    return filtrados.filter((l) => l.stage_id === stageId);
  }

  async function moverLead(lead: CrmLead, direcao: -1 | 1) {
    const idx = etapasAtivas.findIndex((s) => s.id === lead.stage_id);
    const destino = etapasAtivas[idx + direcao];
    if (!destino) return;
    await aplicarEtapa(lead, destino.id);
  }

  async function aplicarEtapa(lead: CrmLead, stageId: string) {
    if (!podeEditar || stageId === lead.stage_id) return;
    setMovendo(lead.id);
    try {
      const { error: err } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId })
        .eq("id", lead.id);
      if (err) throw err;
      await reload();
    } catch (err) {
      feedback.showError(
        "Não foi possível mover o lead",
        "Ocorreu um erro ao atualizar a etapa do lead. Tente novamente.",
        err,
      );
    } finally {
      setMovendo(null);
    }
  }

  async function excluirLead(lead: CrmLead) {
    if (!podeExcluir) return;
    try {
      const { error: err } = await supabase
        .from("crm_leads")
        .delete()
        .eq("id", lead.id);
      if (err) throw err;
      await reload();
      feedback.showSuccess("Lead excluído", `${lead.nome} foi removido do CRM.`);
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
          Não foi possível carregar o CRM. Verifique suas permissões e tente
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
            Módulo · CRM
          </p>
          <h1 className="mt-2 font-serif text-3xl text-foreground">
            Funil de leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.length} lead(s) em {etapasAtivas.length} etapa(s).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <Button variant="outline" asChild>
              <Link to="/crm/etapas">
                <Layers className="mr-2 h-4 w-4" />
                Etapas
              </Link>
            </Button>
          )}
          {podeEditar && (
            <Button onClick={() => navigate("/crm/leads/novo")}>
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Buscar por nome, WhatsApp ou origem..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
          <SelectTrigger className="sm:max-w-[220px]">
            <SelectValue placeholder="Todas as etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as etapas</SelectItem>
            {etapasAtivas.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : etapasAtivas.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-background p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma etapa cadastrada. Crie as etapas do funil para começar.
          </p>
          {podeEditar && (
            <Button className="mt-4" asChild>
              <Link to="/crm/etapas">Cadastrar etapas</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* KANBAN — somente em computadores (lg+) */}
          <div className="hidden lg:block">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {etapasAtivas.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsDaEtapa(stage.id)}
                  podeEditar={podeEditar}
                  podeExcluir={podeExcluir}
                  movendo={movendo}
                  onDropLead={(leadId) => {
                    const lead = leads.find((l) => l.id === leadId);
                    if (lead) void aplicarEtapa(lead, stage.id);
                  }}
                  onEdit={(lead) => navigate(`/crm/leads/${lead.id}`)}
                  onDelete={excluirLead}
                />
              ))}
            </div>
          </div>

          {/* LISTA — mobile e tablet */}
          <div className="space-y-6 lg:hidden">
            {etapasAtivas.map((stage) => {
              const items = leadsDaEtapa(stage.id);
              return (
                <section key={stage.id}>
                  <header className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.cor }}
                    />
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
                      {stage.nome}
                    </h2>
                    <span className="text-[11px] text-muted-foreground">
                      ({items.length})
                    </span>
                  </header>

                  {items.length === 0 ? (
                    <p className="rounded-sm border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground">
                      Nenhum lead nesta etapa.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-background">
                      {items.map((lead) => (
                        <li key={lead.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {lead.nome}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {lead.whatsapp} · {lead.origem}
                              </p>
                            </div>
                            <a
                              href={whatsappLink(lead.whatsapp)}
                              target="_blank"
                              rel="noreferrer"
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground"
                              aria-label={`Abrir WhatsApp de ${lead.nome}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {podeEditar && (
                              <Select
                                value={lead.stage_id ?? ""}
                                onValueChange={(v) => void aplicarEtapa(lead, v)}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder="Etapa" />
                                </SelectTrigger>
                                <SelectContent>
                                  {etapasAtivas.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {podeEditar && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => navigate(`/crm/leads/${lead.id}`)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {podeExcluir && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-destructive"
                                onClick={() => void excluirLead(lead)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );

  function KanbanColumn({
    stage,
    leads: items,
    podeEditar,
    podeExcluir,
    movendo,
    onDropLead,
    onEdit,
    onDelete,
  }: {
    stage: CrmStage;
    leads: CrmLead[];
    podeEditar: boolean;
    podeExcluir: boolean;
    movendo: string | null;
    onDropLead: (leadId: string) => void;
    onEdit: (lead: CrmLead) => void;
    onDelete: (lead: CrmLead) => void;
  }) {
    const [over, setOver] = useState(false);

    return (
      <div
        onDragOver={(e) => {
          if (!podeEditar) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData("text/lead-id");
          if (id) onDropLead(id);
        }}
        className={cn(
          "flex w-[300px] shrink-0 flex-col rounded-sm border border-border bg-background",
          over && "border-brand-accent bg-muted/60",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: stage.cor }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
              {stage.nome}
            </span>
          </div>
          <span className="rounded-sm bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {items.length}
          </span>
        </div>

        <div className="flex-1 space-y-3 p-3">
          {items.length === 0 && (
            <p className="rounded-sm border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Arraste leads para cá
            </p>
          )}
          {items.map((lead) => (
            <article
              key={lead.id}
              draggable={podeEditar}
              onDragStart={(e) =>
                e.dataTransfer.setData("text/lead-id", lead.id)
              }
              className={cn(
                "rounded-sm border border-border bg-card p-3 shadow-sm transition-opacity",
                podeEditar && "cursor-grab active:cursor-grabbing",
                movendo === lead.id && "opacity-50",
              )}
            >
              <p className="truncate text-sm font-medium text-foreground">
                {lead.nome}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lead.whatsapp}
              </p>
              <span className="mt-2 inline-block rounded-sm bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                {lead.origem}
              </span>

              <div className="mt-3 flex items-center justify-between gap-1 border-t border-border pt-2">
                <div className="flex gap-1">
                  {podeEditar && (
                    <>
                      <button
                        type="button"
                        title="Etapa anterior"
                        onClick={() => void moverLead(lead, -1)}
                        className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Próxima etapa"
                        onClick={() => void moverLead(lead, 1)}
                        className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <a
                    href={whatsappLink(lead.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir WhatsApp"
                    className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                  {podeEditar && (
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => onEdit(lead)}
                      className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {podeExcluir && (
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => onDelete(lead)}
                      className="grid h-7 w-7 place-items-center rounded-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }
}
