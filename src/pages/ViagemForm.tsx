import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Loader2, Plus, Save, X } from "lucide-react";


import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, HintButton } from "@/components/help";
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
  const [arrastando, setArrastando] = useState<number | null>(null);


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

  /** Reordena os itens inclusos movendo o item de `origem` para `destinoIdx`. */
  function reordenar(origem: number, destinoIdx: number) {
    setItens((prev) => {
      if (
        origem === destinoIdx ||
        origem < 0 ||
        destinoIdx < 0 ||
        origem >= prev.length ||
        destinoIdx >= prev.length
      ) {
        return prev;
      }
      const copia = [...prev];
      const [movido] = copia.splice(origem, 1);
      copia.splice(destinoIdx, 0, movido);
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
        <HintButton
          hint="Volta para a lista de viagens sem salvar alterações."
          variant="outline"
          size="icon"
          onClick={() => navigate("/viagens")}
        >
          <ArrowLeft className="h-4 w-4" />
        </HintButton>
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
              <FieldLabel htmlFor="destino" help="Cidade ou local para onde a viagem vai acontecer.">
                Destino
              </FieldLabel>
              <Input
                id="destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Ex.: Gramado - RS"
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="data" help="Data em que os passageiros vão embarcar para a viagem.">
                Data de partida
              </FieldLabel>
              <Input
                id="data"
                type="date"
                value={dataPartida}
                onChange={(e) => setDataPartida(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <FieldLabel htmlFor="valor" help="Preço cobrado por pessoa nesta viagem.">
                Valor
              </FieldLabel>
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
              <FieldLabel help="Indica em que etapa a viagem está: rascunho, confirmada, etc.">
                Situação
              </FieldLabel>
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
              <FieldLabel htmlFor="item" help="Coisas que já estão incluídas no preço, como refeições e passeios.">
                Itens inclusos
              </FieldLabel>
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
                <HintButton
                  hint="Adiciona este item à lista de itens inclusos na viagem."
                  type="button"
                  variant="outline"
                  onClick={adicionarItem}
                >
                  <Plus className="h-4 w-4" />
                </HintButton>
              </div>

              {itens.length > 0 ? (
                <ul className="mt-3 divide-y divide-border rounded-sm border border-border">
                  {itens.map((item, i) => (
                    <li
                      key={`${item}-${i}`}
                      draggable
                      onDragStart={() => setArrastando(i)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (arrastando !== null && arrastando !== i) {
                          reordenar(arrastando, i);
                          setArrastando(i);
                        }
                      }}
                      onDragEnd={() => setArrastando(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setArrastando(null);
                      }}
                      className={`flex cursor-grab items-center gap-3 px-3 py-2 transition-opacity active:cursor-grabbing ${
                        arrastando === i ? "bg-muted opacity-60" : ""
                      }`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-6 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-sm text-foreground">
                        {item}
                      </span>
                      <HintButton
                        hint="Remove este item da lista de itens inclusos."
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setItens((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Remover ${item}`}
                      >
                        <X className="h-4 w-4" />
                      </HintButton>
                    </li>
                  ))}
                </ul>
              ) : (

                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum item incluso adicionado.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-border pt-6">
            <HintButton
              hint="Descarta as alterações e volta para a lista de viagens."
              variant="outline"
              onClick={() => navigate("/viagens")}
            >
              Cancelar
            </HintButton>
            <HintButton
              hint="Grava os dados desta viagem no sistema."
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </HintButton>
          </div>
        </div>
      )}
    </AppShell>
  );
}
