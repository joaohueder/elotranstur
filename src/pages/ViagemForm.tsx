import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import {
  VIAGEM_SITUACOES,
  maskValor,
  parseValor,
  type ViagemSituacao,
} from "@/lib/viagens";

export default function ViagemForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const feedback = useFeedback();

  const [loading, setLoading] = useState(Boolean(id));
  const [salvando, setSalvando] = useState(false);
  const [destino, setDestino] = useState("");
  const [dataPartida, setDataPartida] = useState("");
  const [situacao, setSituacao] = useState<ViagemSituacao>("rascunho");
  const [valor, setValor] = useState("");
  const [itens, setItens] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("viagens")
          .select("destino, data_partida, valor, itens_inclusos, situacao")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!ativo || !data) return;
        setDestino(data.destino ?? "");
        setDataPartida(data.data_partida ?? "");
        setValor(maskValor(String(Math.round(Number(data.valor ?? 0) * 100))));
        setItens((data.itens_inclusos ?? []) as string[]);
        setSituacao((data.situacao ?? "rascunho") as ViagemSituacao);
      } catch (err) {
        feedback.showError(
          "Não foi possível carregar",
          "Ocorreu um erro ao carregar os dados da viagem.",
          err,
        );
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function adicionarItem() {
    const texto = novoItem.trim();
    if (!texto) return;
    if (itens.some((i) => i.toLowerCase() === texto.toLowerCase())) {
      feedback.showNegative("Item duplicado", "Este item já foi adicionado.");
      return;
    }
    setItens((prev) => [...prev, texto]);
    setNovoItem("");
  }

  /** Move um item incluso para cima ou para baixo na ordem. */
  function moverItem(indice: number, direcao: -1 | 1) {
    setItens((prev) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  async function salvar() {
    if (!destino.trim()) {
      feedback.showNegative("Campo obrigatório", "Informe o destino da viagem.");
      return;
    }
    if (!dataPartida) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe a data de partida da viagem.",
      );
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        destino: destino.trim(),
        data_partida: dataPartida,
        valor: parseValor(valor),
        itens_inclusos: itens,
        situacao,
      };
      const { error } = editando
        ? await supabase.from("viagens").update(payload).eq("id", id!)
        : await supabase.from("viagens").insert(payload);
      if (error) throw error;

      feedback.showSuccess(
        editando ? "Viagem atualizada" : "Viagem cadastrada",
        `${payload.destino} foi ${editando ? "atualizada" : "cadastrada"} com sucesso.`,
      );
      navigate("/viagens");
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar a viagem. Tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/viagens")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · Viagens
          </p>
          <h1 className="mt-1 font-serif text-3xl text-foreground">
            {editando ? "Editar viagem" : "Nova viagem"}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="w-full rounded-sm border border-border bg-background p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="destino">Destino</Label>
              <Input
                id="destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Ex.: Gramado - RS"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="data">Data de partida</Label>
              <Input
                id="data"
                type="date"
                value={dataPartida}
                onChange={(e) => setDataPartida(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="valor">Valor</Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  R$
                </span>
                <Input
                  id="valor"
                  value={valor}
                  onChange={(e) => setValor(maskValor(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Situação</Label>
              <Select
                value={situacao}
                onValueChange={(v) => setSituacao(v as ViagemSituacao)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIAGEM_SITUACOES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="item">Itens inclusos</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="item"
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarItem();
                    }
                  }}
                  placeholder="Ex.: Café da manhã"
                />
                <Button type="button" variant="outline" onClick={adicionarItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {itens.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {itens.map((item, i) => (
                    <span
                      key={`${item}-${i}`}
                      className="flex items-center gap-2 rounded-sm bg-muted px-2.5 py-1 text-xs text-foreground"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() =>
                          setItens((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remover ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum item incluso adicionado.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-border pt-6">
            <Button variant="outline" onClick={() => navigate("/viagens")}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
