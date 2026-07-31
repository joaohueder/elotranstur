import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCrmData, type CrmStage } from "@/lib/crm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type Draft = Pick<CrmStage, "id" | "nome" | "cor" | "posicao" | "ativo"> & {
  novo?: boolean;
};

export default function CrmEtapas() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { can, isAdmin } = useAuthz();
  const { stages, leads, loading, reload } = useCrmData();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = isAdmin || can("crm", "edit");
  const podeExcluir = isAdmin || can("crm", "delete");
  const lista: Draft[] = drafts ?? stages.map((s) => ({ ...s }));

  function update(index: number, patch: Partial<Draft>) {
    setDrafts(
      lista.map((s, i) => (i === index ? { ...s, ...patch } : { ...s })),
    );
  }

  function mover(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= lista.length) return;
    const copia = lista.map((s) => ({ ...s }));
    const [item] = copia.splice(index, 1);
    copia.splice(alvo, 0, item);
    setDrafts(copia.map((s, i) => ({ ...s, posicao: i })));
  }

  function adicionar() {
    setDrafts([
      ...lista.map((s) => ({ ...s })),
      {
        id: `novo-${Date.now()}`,
        nome: "",
        cor: "#64748b",
        posicao: lista.length,
        ativo: true,
        novo: true,
      },
    ]);
  }

  async function remover(index: number) {
    const item = lista[index];
    if (item.novo) {
      setDrafts(
        lista.filter((_, i) => i !== index).map((s, i) => ({ ...s, posicao: i })),
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
      setDrafts(null);
      await reload();
      feedback.showSuccess("Etapa excluída", `"${item.nome}" foi removida.`);
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir a etapa. Tente novamente.",
        err,
      );
    }
  }

  async function salvar() {
    if (!podeEditar) return;
    if (lista.some((s) => !s.nome.trim())) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o nome de todas as etapas antes de salvar.",
      );
      return;
    }

    setSalvando(true);
    try {
      const novos = lista.filter((s) => s.novo);
      const existentes = lista.filter((s) => !s.novo);

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

      setDrafts(null);
      await reload();
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
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/crm")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · CRM
          </p>
          <h1 className="mt-1 font-serif text-3xl text-foreground">
            Etapas do funil
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="max-w-3xl rounded-sm border border-border bg-background">
          <ul className="divide-y divide-border">
            {lista.map((s, index) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={s.cor}
                    disabled={!podeEditar}
                    onChange={(e) => update(index, { cor: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-sm border border-border bg-background p-1"
                    aria-label="Cor da etapa"
                  />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => mover(index, -1)}
                      disabled={!podeEditar || index === 0}
                      className="grid h-4 w-6 place-items-center text-muted-foreground disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(index, 1)}
                      disabled={!podeEditar || index === lista.length - 1}
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
                  onChange={(e) => update(index, { nome: e.target.value })}
                  className="flex-1"
                />

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={s.ativo}
                      disabled={!podeEditar}
                      onCheckedChange={(v) => update(index, { ativo: v })}
                    />
                    Ativa
                  </label>
                  {(podeExcluir || s.novo) && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive"
                      onClick={() => void remover(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {lista.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma etapa cadastrada.
              </li>
            )}
          </ul>

          {podeEditar && (
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={adicionar}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar etapa
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDrafts(null)}
                  disabled={!drafts}
                >
                  Descartar
                </Button>
                <Button onClick={salvar} disabled={salvando}>
                  {salvando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar etapas
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
