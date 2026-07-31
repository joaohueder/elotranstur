import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  KanbanSquare,
  Loader2,
  Plus,
  Save,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useCrmData,
  useCrmOrigens,
  type CrmOrigem,
  type CrmStage,
} from "@/lib/crm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type StageDraft = CrmStage & { novo?: boolean };
type OrigemDraft = CrmOrigem & { novo?: boolean };

function GroupHeader({
  icon,
  titulo,
  descricao,
  help,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  help: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {titulo}
          <HelpTip texto={help} />
        </p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
    </div>
  );
}

export function CrmTab() {
  const feedback = useFeedback();
  const { can, isAdmin } = useAuthz();
  const { stages, leads, loading: loadingStages, reload: reloadStages } =
    useCrmData();
  const { origens, loading: loadingOrigens, reload: reloadOrigens } =
    useCrmOrigens();

  const podeEditar = isAdmin || can("crm", "edit");
  const podeExcluir = isAdmin || can("crm", "delete");

  const [stageDrafts, setStageDrafts] = useState<StageDraft[] | null>(null);
  const [origemDrafts, setOrigemDrafts] = useState<OrigemDraft[] | null>(null);
  const [salvandoStages, setSalvandoStages] = useState(false);
  const [salvandoOrigens, setSalvandoOrigens] = useState(false);

  const listaStages: StageDraft[] = stageDrafts ?? stages.map((s) => ({ ...s }));
  const listaOrigens: OrigemDraft[] =
    origemDrafts ?? origens.map((o) => ({ ...o }));

  // ---------------- Etapas ----------------
  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStageDrafts(
      listaStages.map((s, i) => (i === index ? { ...s, ...patch } : { ...s })),
    );
  }

  function moverStage(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= listaStages.length) return;
    const copia = listaStages.map((s) => ({ ...s }));
    const [item] = copia.splice(index, 1);
    copia.splice(alvo, 0, item);
    setStageDrafts(copia.map((s, i) => ({ ...s, posicao: i })));
  }

  function adicionarStage() {
    setStageDrafts([
      ...listaStages.map((s) => ({ ...s })),
      {
        id: `novo-${Date.now()}`,
        nome: "",
        cor: "#64748b",
        posicao: listaStages.length,
        ativo: true,
        novo: true,
      },
    ]);
  }

  async function removerStage(index: number) {
    const item = listaStages[index];
    if (item.novo) {
      setStageDrafts(
        listaStages
          .filter((_, i) => i !== index)
          .map((s, i) => ({ ...s, posicao: i })),
      );
      return;
    }
    if (!podeExcluir) return;
    if (leads.some((l) => l.stage_id === item.id)) {
      feedback.showNegative(
        "Etapa em uso",
        `A etapa "${item.nome}" possui leads vinculados. Mova os leads antes de excluí-la.`,
      );
      return;
    }
    try {
      const { error: err } = await supabase
        .from("crm_stages")
        .delete()
        .eq("id", item.id);
      if (err) throw err;
      setStageDrafts(null);
      await reloadStages();
      feedback.showSuccess("Etapa excluída", `"${item.nome}" foi removida.`);
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir a etapa. Tente novamente.",
        err,
      );
    }
  }

  async function salvarStages() {
    if (!podeEditar) return;
    if (listaStages.some((s) => !s.nome.trim())) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o nome de todas as etapas antes de salvar.",
      );
      return;
    }
    setSalvandoStages(true);
    try {
      const novos = listaStages.filter((s) => s.novo);
      const existentes = listaStages.filter((s) => !s.novo);

      if (novos.length) {
        const { error: err } = await supabase.from("crm_stages").insert(
          novos.map((s) => ({
            nome: s.nome.trim(),
            cor: s.cor,
            posicao: s.posicao,
            ativo: s.ativo,
          })),
        );
        if (err) throw err;
      }
      for (const s of existentes) {
        const { error: err } = await supabase
          .from("crm_stages")
          .update({
            nome: s.nome.trim(),
            cor: s.cor,
            posicao: s.posicao,
            ativo: s.ativo,
          })
          .eq("id", s.id);
        if (err) throw err;
      }

      setStageDrafts(null);
      await reloadStages();
      feedback.showSuccess(
        "Etapas salvas",
        "As etapas do funil foram atualizadas com sucesso.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar as etapas do funil. Tente novamente.",
        err,
      );
    } finally {
      setSalvandoStages(false);
    }
  }

  // ---------------- Origens ----------------
  function updateOrigem(index: number, patch: Partial<OrigemDraft>) {
    setOrigemDrafts(
      listaOrigens.map((o, i) => (i === index ? { ...o, ...patch } : { ...o })),
    );
  }

  function moverOrigem(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= listaOrigens.length) return;
    const copia = listaOrigens.map((o) => ({ ...o }));
    const [item] = copia.splice(index, 1);
    copia.splice(alvo, 0, item);
    setOrigemDrafts(copia.map((o, i) => ({ ...o, posicao: i })));
  }

  function adicionarOrigem() {
    setOrigemDrafts([
      ...listaOrigens.map((o) => ({ ...o })),
      {
        id: `novo-${Date.now()}`,
        nome: "",
        posicao: listaOrigens.length,
        ativo: true,
        sistema: false,
        novo: true,
      },
    ]);
  }

  async function removerOrigem(index: number) {
    const item = listaOrigens[index];
    if (item.novo) {
      setOrigemDrafts(
        listaOrigens
          .filter((_, i) => i !== index)
          .map((o, i) => ({ ...o, posicao: i })),
      );
      return;
    }
    if (item.sistema) {
      feedback.showNegative(
        "Origem do sistema",
        `A origem "${item.nome}" é usada pelo próprio sistema e não pode ser excluída.`,
      );
      return;
    }
    if (!podeExcluir) return;
    try {
      const { error: err } = await supabase
        .from("crm_origens")
        .delete()
        .eq("id", item.id);
      if (err) throw err;
      setOrigemDrafts(null);
      await reloadOrigens();
      feedback.showSuccess("Origem excluída", `"${item.nome}" foi removida.`);
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir a origem. Verifique se ela não está em uso.",
        err,
      );
    }
  }

  async function salvarOrigens() {
    if (!podeEditar) return;
    const nomes = listaOrigens.map((o) => o.nome.trim().toLowerCase());
    if (nomes.some((n) => !n)) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o nome de todas as origens antes de salvar.",
      );
      return;
    }
    if (new Set(nomes).size !== nomes.length) {
      feedback.showNegative(
        "Origem duplicada",
        "Existem origens com o mesmo nome. Cada origem deve ser única.",
      );
      return;
    }

    setSalvandoOrigens(true);
    try {
      const novos = listaOrigens.filter((o) => o.novo);
      const existentes = listaOrigens.filter((o) => !o.novo);

      if (novos.length) {
        const { error: err } = await supabase.from("crm_origens").insert(
          novos.map((o) => ({
            nome: o.nome.trim(),
            posicao: o.posicao,
            ativo: o.ativo,
          })),
        );
        if (err) throw err;
      }
      for (const o of existentes) {
        // Origens do sistema (ex.: Landing Page) só permitem reordenar.
        const payload = o.sistema
          ? { posicao: o.posicao }
          : { nome: o.nome.trim(), posicao: o.posicao, ativo: o.ativo };
        const { error: err } = await supabase
          .from("crm_origens")
          .update(payload)
          .eq("id", o.id);
        if (err) throw err;
      }

      setOrigemDrafts(null);
      await reloadOrigens();
      feedback.showSuccess(
        "Origens salvas",
        "As origens dos leads foram atualizadas com sucesso.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar as origens dos leads. Tente novamente.",
        err,
      );
    } finally {
      setSalvandoOrigens(false);
    }
  }

  const carregando = loadingStages || loadingOrigens;

  if (carregando) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-10">
      {/* Grupo: Etapas do funil */}
      <section className="space-y-4">
        <GroupHeader
          icon={<KanbanSquare className="h-4 w-4" />}
          titulo="Etapas do funil"
          descricao="Colunas do kanban do CRM. Defina nome, cor, ordem e disponibilidade."
          help="Etapas são as colunas do funil de vendas, por onde os leads passam até fechar."
        />

        <div className="rounded-sm border border-border">
          <ul className="divide-y divide-border">
            {listaStages.map((s, index) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={s.cor}
                    disabled={!podeEditar}
                    onChange={(e) => updateStage(index, { cor: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-sm border border-border bg-background p-1"
                    aria-label="Cor da etapa"
                  />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moverStage(index, -1)}
                      disabled={!podeEditar || index === 0}
                      className="grid h-4 w-6 place-items-center text-muted-foreground disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverStage(index, 1)}
                      disabled={!podeEditar || index === listaStages.length - 1}
                      className="grid h-4 w-6 place-items-center text-muted-foreground disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <Input
                  value={s.nome}
                  disabled={!podeEditar}
                  placeholder="Nome da etapa"
                  onChange={(e) => updateStage(index, { nome: e.target.value })}
                  className="flex-1 rounded-sm"
                />

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={s.ativo}
                      disabled={!podeEditar}
                      onCheckedChange={(v) => updateStage(index, { ativo: v })}
                    />
                    Ativa
                  </label>
                  {(podeExcluir || s.novo) && (
                    <HintButton
                      hint="Remove esta etapa do funil."
                      variant="outline"
                      size="icon"
                      className="rounded-sm text-destructive"
                      onClick={() => void removerStage(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </HintButton>
                  )}
                </div>
              </li>
            ))}
            {listaStages.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma etapa cadastrada.
              </li>
            )}
          </ul>

          {podeEditar && (
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
              <HintButton
                hint="Cria uma nova coluna/etapa no funil de vendas."
                variant="outline"
                className="rounded-sm"
                onClick={adicionarStage}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar etapa
              </HintButton>
              <HintButton
                hint="Grava as alterações feitas nas etapas do funil."
                className="rounded-sm sm:min-w-32"
                disabled={salvandoStages}
                onClick={() => void salvarStages()}
              >
                {salvandoStages ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar etapas
              </HintButton>
            </div>
          )}
        </div>
      </section>

      {/* Grupo: Origens dos leads */}
      <section className="space-y-4">
        <GroupHeader
          icon={<Tag className="h-4 w-4" />}
          titulo="Origens dos leads"
          descricao="Opções disponíveis no campo Origem do cadastro de leads."
          help="Origens indicam de onde veio o lead, como indicação, site ou redes sociais."
        />

        <div className="rounded-sm border border-border">
          <ul className="divide-y divide-border">
            {listaOrigens.map((o, index) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moverOrigem(index, -1)}
                    disabled={!podeEditar || index === 0}
                    className="grid h-4 w-6 place-items-center text-muted-foreground disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverOrigem(index, 1)}
                    disabled={!podeEditar || index === listaOrigens.length - 1}
                    className="grid h-4 w-6 place-items-center text-muted-foreground disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Input
                  value={o.nome}
                  disabled={!podeEditar || o.sistema}
                  placeholder="Nome da origem"
                  onChange={(e) => updateOrigem(index, { nome: e.target.value })}
                  className="flex-1 rounded-sm"
                />

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={o.ativo}
                      disabled={!podeEditar || o.sistema}
                      onCheckedChange={(v) => updateOrigem(index, { ativo: v })}
                    />
                    Ativa
                  </label>
                  {o.sistema && (
                    <span className="flex items-center gap-1 rounded-sm bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Sistema
                      <HelpTip texto="Origem usada automaticamente pelo sistema (landing pages). Não pode ser editada nem excluída." />
                    </span>
                  )}
                  {!o.sistema && (podeExcluir || o.novo) && (
                    <HintButton
                      hint="Remove esta origem da lista."
                      variant="outline"
                      size="icon"
                      className="rounded-sm text-destructive"
                      onClick={() => void removerOrigem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </HintButton>
                  )}
                </div>
              </li>
            ))}
            {listaOrigens.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma origem cadastrada.
              </li>
            )}
          </ul>

          {podeEditar && (
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
              <HintButton
                hint="Cria uma nova origem para ser usada no cadastro de leads."
                variant="outline"
                className="rounded-sm"
                onClick={adicionarOrigem}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar origem
              </HintButton>
              <HintButton
                hint="Grava as alterações feitas nas origens dos leads."
                className="rounded-sm sm:min-w-32"
                disabled={salvandoOrigens}
                onClick={() => void salvarOrigens()}
              >
                {salvandoOrigens ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar origens
              </HintButton>
            </div>
          )}
        </div>
      </section>

      {!podeEditar && (
        <p className="text-xs text-muted-foreground">
          Você tem apenas permissão de visualização no módulo CRM.
        </p>
      )}
    </div>
  );
}
