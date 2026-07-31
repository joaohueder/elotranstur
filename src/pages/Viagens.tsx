import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

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
  VIAGEM_SITUACOES,
  formatarData,
  situacaoClasses,
  situacaoLabel,
  type Viagem,
} from "@/lib/viagens";

export default function Viagens() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { can, isAdmin } = useAuthz();

  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const podeEditar = isAdmin || can("viagens", "edit");
  const podeExcluir = isAdmin || can("viagens", "delete");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("viagens")
        .select("id, destino, data_partida, itens_inclusos, situacao, created_at")
        .order("data_partida", { ascending: true });
      if (error) throw error;
      setViagens((data ?? []) as Viagem[]);
    } catch (err) {
      feedback.showError(
        "Não foi possível carregar",
        "Ocorreu um erro ao carregar as viagens cadastradas.",
        err,
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return viagens.filter((v) => {
      const okTermo =
        !termo ||
        v.destino.toLowerCase().includes(termo) ||
        (v.itens_inclusos ?? []).some((i) => i.toLowerCase().includes(termo));
      const okSituacao = filtro === "todas" || v.situacao === filtro;
      return okTermo && okSituacao;
    });
  }, [viagens, busca, filtro]);

  async function excluir(v: Viagem) {
    if (!podeExcluir) return;
    setExcluindo(v.id);
    try {
      const { error } = await supabase.from("viagens").delete().eq("id", v.id);
      if (error) throw error;
      feedback.showSuccess(
        "Viagem excluída",
        `A viagem para ${v.destino} foi excluída com sucesso.`,
      );
      await carregar();
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao excluir a viagem. Tente novamente.",
        err,
      );
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · Viagens
          </p>
          <h1 className="mt-1 font-serif text-3xl text-foreground">Viagens</h1>
        </div>
        {podeEditar && (
          <Button onClick={() => navigate("/viagens/nova")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova viagem
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por destino ou item incluso"
          className="sm:max-w-sm"
        />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            {VIAGEM_SITUACOES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-background p-12 text-center">
          <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma viagem encontrada.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-sm border border-border bg-background">
          {filtradas.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-serif text-lg text-foreground">
                    {v.destino}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                      situacaoClasses(v.situacao),
                    )}
                  >
                    {situacaoLabel(v.situacao)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Partida · {formatarData(v.data_partida)}
                </p>
                {(v.itens_inclusos ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {v.itens_inclusos.map((item, i) => (
                      <span
                        key={`${v.id}-${i}`}
                        className="rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {podeEditar && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/viagens/${v.id}`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {podeExcluir && (
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={excluindo === v.id}
                    onClick={() => void excluir(v)}
                  >
                    {excluindo === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
