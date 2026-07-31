import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Lock, MapPin, Plus, Save, Trash2 } from "lucide-react";

import { HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDestinos, type Destino } from "@/lib/destinos";
import { useConfirm } from "@/lib/confirm";
import { useFeedback } from "@/lib/feedback";
import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type DestinoDraft = Destino & { novo?: boolean };

export function DestinosTab() {
  const feedback = useFeedback();
  const { confirm } = useConfirm();
  const { can, isAdmin } = useAuthz();
  const { destinos, loading, reload } = useDestinos();

  const podeEditar = isAdmin || can("configuracoes", "edit");
  const podeExcluir = isAdmin || can("configuracoes", "delete");

  const [drafts, setDrafts] = useState<DestinoDraft[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [emUso, setEmUso] = useState<Record<string, number>>({});

  const carregarUso = useCallback(async () => {
    const { data } = await supabase.from("viagens").select("destino");
    const mapa: Record<string, number> = {};
    for (const linha of data ?? []) {
      const chave = (linha.destino ?? "").trim().toLowerCase();
      if (!chave) continue;
      mapa[chave] = (mapa[chave] ?? 0) + 1;
    }
    setEmUso(mapa);
  }, []);

  useEffect(() => {
    void carregarUso();
  }, [carregarUso]);

  useRealtime(["viagens"], () => void carregarUso());

  /** Conta viagens usando o destino, aceitando "Nome" ou "Nome - UF". */
  const usos = (d: { nome: string; uf?: string | null }) => {
    const base = (d.nome ?? "").trim().toLowerCase();
    if (!base) return 0;
    const uf = (d.uf ?? "").trim().toLowerCase();
    const chaves = new Set([base]);
    if (uf) {
      chaves.add(`${base} - ${uf}`);
      chaves.add(`${base}/${uf}`);
      chaves.add(`${base} ${uf}`);
    }
    let total = 0;
    for (const chave of chaves) total += emUso[chave] ?? 0;
    return total;
  };

  const lista: DestinoDraft[] = drafts ?? destinos.map((d) => ({ ...d }));


  function update(index: number, patch: Partial<DestinoDraft>) {
    setDrafts(lista.map((d, i) => (i === index ? { ...d, ...patch } : { ...d })));
  }

  function mover(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= lista.length) return;
    const copia = lista.map((d) => ({ ...d }));
    const [item] = copia.splice(index, 1);
    copia.splice(alvo, 0, item);
    setDrafts(copia.map((d, i) => ({ ...d, posicao: i })));
  }

  function adicionar() {
    setDrafts([
      ...lista.map((d) => ({ ...d })),
      {
        id: `novo-${Date.now()}`,
        nome: "",
        uf: "",
        ativo: true,
        posicao: lista.length,
        novo: true,
      },
    ]);
  }

  async function remover(index: number) {
    const item = lista[index];
    if (item.novo) {
      setDrafts(lista.filter((_, i) => i !== index).map((d, i) => ({ ...d, posicao: i })));
      return;
    }
    if (!podeExcluir) return;
    const quantidade = usos(item.nome);
    if (quantidade > 0) {
      feedback.showNegative(
        "Destino em uso",
        `O destino "${item.nome}" está sendo usado em ${quantidade} viagem(ns) e por isso não pode ser excluído. Altere ou exclua essas viagens antes.`,
      );
      return;
    }

    const ok = await confirm({
      title: "Excluir destino",
      message: `Tem certeza que deseja excluir o destino "${item.nome}"? Esta ação não poderá ser desfeita.`,
      confirmText: "Sim, excluir",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const { error: err } = await supabase.from("destinos").delete().eq("id", item.id);
      if (err) throw err;
      setDrafts(null);
      await reload();
      feedback.showSuccess("Destino excluído", `"${item.nome}" foi removido da lista.`);
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir o destino. Ele pode estar sendo usado em alguma viagem.",
        err,
      );
    }
  }

  async function salvar() {
    if (!podeEditar) return;
    const nomes = lista.map((d) => d.nome.trim().toLowerCase());
    if (nomes.some((n) => !n)) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o nome de todos os destinos antes de salvar.",
      );
      return;
    }
    if (new Set(nomes).size !== nomes.length) {
      feedback.showNegative(
        "Destino duplicado",
        "Existem destinos com o mesmo nome. Cada destino deve ser único.",
      );
      return;
    }

    setSalvando(true);
    try {
      const novos = lista.filter((d) => d.novo);
      const existentes = lista.filter((d) => !d.novo);

      if (novos.length) {
        const { error: err } = await supabase.from("destinos").insert(
          novos.map((d) => ({
            nome: d.nome.trim(),
            uf: d.uf?.trim() ? d.uf.trim().toUpperCase() : null,
            ativo: d.ativo,
            posicao: d.posicao,
          })),
        );
        if (err) throw err;
      }
      for (const d of existentes) {
        const { error: err } = await supabase
          .from("destinos")
          .update({
            nome: d.nome.trim(),
            uf: d.uf?.trim() ? d.uf.trim().toUpperCase() : null,
            ativo: d.ativo,
            posicao: d.posicao,
          })
          .eq("id", d.id);
        if (err) throw err;
      }

      setDrafts(null);
      await reload();
      feedback.showSuccess(
        "Destinos salvos",
        "A lista de destinos disponíveis foi atualizada com sucesso.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar os destinos. Tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Destinos disponíveis
            <HelpTip texto="Lista de lugares para onde a empresa vende viagens. Só aparecem aqui os destinos que você cadastrar." />
          </p>
          <p className="text-xs text-muted-foreground">
            Opções que aparecem no campo Destino do cadastro de viagens.
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-border">
        <ul className="divide-y divide-border">
          {lista.map((d, index) => (
            <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
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

              <Input
                value={d.nome}
                disabled={!podeEditar}
                placeholder="Nome do destino (ex.: Gramado)"
                onChange={(e) => update(index, { nome: e.target.value })}
                className="flex-1 rounded-sm"
              />

              <Input
                value={d.uf ?? ""}
                disabled={!podeEditar}
                maxLength={2}
                placeholder="UF"
                onChange={(e) => update(index, { uf: e.target.value.toUpperCase() })}
                className="w-full rounded-sm uppercase sm:w-20"
              />

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                {!d.novo && usos(d.nome) > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Em uso ({usos(d.nome)})
                  </span>
                )}
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={d.ativo}
                    disabled={!podeEditar}
                    onCheckedChange={(v) => update(index, { ativo: v })}
                  />
                  Ativo
                  <HelpTip texto="Destinos inativos deixam de aparecer para escolha no cadastro de viagens." />
                </label>
                {(podeExcluir || d.novo) && (
                  <HintButton
                    hint={
                      !d.novo && usos(d.nome) > 0
                        ? `Este destino está sendo usado em ${usos(d.nome)} viagem(ns) e não pode ser excluído. Remova ou altere essas viagens primeiro.`
                        : "Remove este destino da lista."
                    }
                    variant="outline"
                    size="icon"
                    className="rounded-sm text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!d.novo && usos(d.nome) > 0}
                    onClick={() => void remover(index)}
                  >
                    {!d.novo && usos(d.nome) > 0 ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </HintButton>
                )}
              </div>

            </li>
          ))}
          {lista.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">
              Nenhum destino cadastrado.
            </li>
          )}
        </ul>

        {podeEditar && (
          <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
            <HintButton
              hint="Cria um novo destino para ser usado no cadastro de viagens."
              variant="outline"
              className="rounded-sm"
              onClick={adicionar}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar destino
            </HintButton>
            <HintButton
              hint="Grava as alterações feitas na lista de destinos."
              className="rounded-sm sm:min-w-32"
              disabled={salvando}
              onClick={() => void salvar()}
            >
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar destinos
            </HintButton>
          </div>
        )}
      </div>

      {!podeEditar && (
        <p className="text-xs text-muted-foreground">
          Você tem apenas permissão de visualização neste módulo.
        </p>
      )}
    </div>
  );
}
