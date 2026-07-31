import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";


import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import { useRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";
import { cn } from "@/lib/utils";
import { ViagemCountdown } from "@/components/viagem-countdown";
import {
  VIAGEM_SITUACOES,
  capaDa,
  formatarData,
  formatarHora,
  formatarValor,
  situacaoClasses,
  situacaoLabel,
  type Viagem,
} from "@/lib/viagens";

export default function Viagens() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { confirm } = useConfirm();
  const { can, isAdmin } = useAuthz();

  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [clonando, setClonando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const landingUrl = (v: Viagem) =>
    v.landing_slug ? `${window.location.origin}/v/${v.landing_slug}` : null;

  async function copiarUrl(v: Viagem) {
    const url = landingUrl(v);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(v.id);
      window.setTimeout(() => setCopiado((a) => (a === v.id ? null : a)), 2000);
    } catch (err) {
      feedback.showError(
        "Não foi possível copiar",
        "Seu navegador bloqueou a cópia automática. Copie o endereço manualmente.",
        err,
      );
    }
  }



  const podeEditar = isAdmin || can("viagens", "edit");
  const podeExcluir = isAdmin || can("viagens", "delete");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("viagens")
        .select(
          "id, titulo, subtitulo, descricao, destino, data_partida, hora_partida, valor, vagas, itens_inclusos, imagens, situacao, created_at, landing_slug, landing_ativa",
        )
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

  useRealtime(["viagens"], () => void carregar(true));

  const filtradas = useMemo(() => {
    const ordemSituacao: Record<string, number> = {
      rascunho: 0,
      ativa: 1,
      fechada: 2,
      concluida: 3,
      cancelada: 4,
    };
    const termo = busca.trim().toLowerCase();
    return viagens
      .filter((v) => {
        const okTermo =
          !termo ||
          v.destino.toLowerCase().includes(termo) ||
          (v.titulo ?? "").toLowerCase().includes(termo) ||
          (v.itens_inclusos ?? []).some((i) => i.toLowerCase().includes(termo));
        const okSituacao = filtro === "todas" || v.situacao === filtro;
        return okTermo && okSituacao;
      })
      .sort((a, b) => {
        const ordemA = ordemSituacao[a.situacao] ?? 99;
        const ordemB = ordemSituacao[b.situacao] ?? 99;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return new Date(a.data_partida).getTime() - new Date(b.data_partida).getTime();
      });
  }, [viagens, busca, filtro]);

  async function excluir(v: Viagem) {
    if (!podeExcluir) return;
    const ok = await confirm({
      title: "Excluir viagem",
      message: `Tem certeza que deseja excluir a viagem para "${v.destino}"? Esta ação não poderá ser desfeita.`,
      confirmText: "Sim, excluir",
      variant: "destructive",
    });
    if (!ok) return;
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

  async function clonar(v: Viagem) {
    if (!podeEditar) return;
    const ok = await confirm({
      title: "Clonar viagem",
      message: `Deseja criar uma cópia da viagem para "${v.destino}"? A cópia será criada como Rascunho.`,
      confirmText: "Sim, clonar",
    });
    if (!ok) return;
    setClonando(v.id);
    try {
      const { data: original, error: erroBusca } = await supabase
        .from("viagens")
        .select(
          "titulo, subtitulo, descricao, destino, data_partida, hora_partida, valor, vagas, itens_inclusos, imagens, landing_modelo, landing_paleta, landing_slug",
        )
        .eq("id", v.id)
        .single();
      if (erroBusca) throw erroBusca;

      const sufixo = Math.random().toString(36).slice(2, 7);
      const payload = {
        ...original,
        titulo: `${original.titulo || original.destino} (cópia)`,
        situacao: "rascunho",
        landing_slug: original.landing_slug
          ? `${original.landing_slug}-copia-${sufixo}`
          : null,
        landing_ativa: false,
      };

      const { error } = await supabase.from("viagens").insert(payload);
      if (error) throw error;

      feedback.showSuccess(
        "Viagem clonada",
        `Uma cópia da viagem para ${v.destino} foi criada como Rascunho.`,
      );
      await carregar();
    } catch (err) {
      feedback.showError(
        "Não foi possível clonar",
        "Ocorreu um erro ao clonar a viagem. Tente novamente.",
        err,
      );
    } finally {
      setClonando(null);
    }
  }


  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · Viagens
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground">Viagens</h1>
            <HelpTip texto="Aqui você vê e gerencia todos os pacotes de viagem cadastrados." />
          </div>
        </div>
        {podeEditar && (
          <HintButton
            hint="Cria um novo cadastro de viagem para vender aos clientes."
            onClick={() => navigate("/viagens/nova")}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova viagem
          </HintButton>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 sm:max-w-sm sm:flex-1">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por destino ou item incluso"
            className="w-full"
          />
          <HelpTip texto="Digite parte do destino ou de um item incluso para filtrar a lista." />
        </div>
        <div className="flex items-center gap-1.5">
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
          <HelpTip texto="Mostra apenas as viagens que estão na situação escolhida." />
        </div>
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
        <>
        {/* CARDS — celular */}
        <div className="grid gap-4 sm:hidden">
          {filtradas.map((v) => (
            <article
              key={v.id}
              className="overflow-hidden rounded-lg border border-border bg-background shadow-sm"
            >
              <div className="relative">
                {capaDa(v.imagens) ? (
                  <img
                    src={capaDa(v.imagens)!}
                    alt={`Foto de capa da viagem para ${v.destino}`}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-24 w-full place-items-center bg-muted">
                    <MapPin className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur",
                    situacaoClasses(v.situacao),
                  )}
                >
                  {situacaoLabel(v.situacao)}
                </span>
              </div>

              <div className="space-y-3 p-4">
                <div className="min-w-0">
                  <h2 className="font-serif text-lg leading-snug text-foreground">
                    {v.titulo || v.destino}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {v.destino}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      Partida
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {formatarData(v.data_partida)}
                      {v.hora_partida ? ` · ${formatarHora(v.hora_partida)}` : ""}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      Por pessoa
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {formatarValor(v.valor)}
                    </p>
                  </div>
                </div>

                <ViagemCountdown data={v.data_partida} hora={v.hora_partida} />

                {(v.itens_inclusos ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {v.itens_inclusos.slice(0, 4).map((item, i) => (
                      <span
                        key={`${v.id}-m-${i}`}
                        className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                    {v.itens_inclusos.length > 4 && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                        +{v.itens_inclusos.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                {podeEditar && (
                  <HintButton
                    hint="Edita os dados desta viagem."
                    variant="outline"
                    className="h-10 flex-1 rounded-md"
                    onClick={() => navigate(`/viagens/${v.id}`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </HintButton>
                )}
                {landingUrl(v) && (
                  <>
                    <HintButton
                      hint="Copia o link de compartilhamento da viagem."
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-md"
                      onClick={() => void copiarUrl(v)}
                    >
                      {copiado === v.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </HintButton>
                    <HintButton
                      hint="Abre a landing page desta viagem em uma nova aba."
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-md"
                      onClick={() =>
                        window.open(landingUrl(v)!, "_blank", "noopener")
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </HintButton>
                  </>
                )}
                {podeExcluir && (
                  <HintButton
                    hint="Exclui esta viagem definitivamente."
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-md text-destructive"
                    disabled={excluindo === v.id}
                    onClick={() => void excluir(v)}
                  >
                    {excluindo === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </HintButton>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* LISTA — tablet e computador */}
        <div className="hidden divide-y divide-border rounded-sm border border-border bg-background sm:block">
          {filtradas.map((v) => (

            <div
              key={v.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="flex min-w-0 gap-3 sm:gap-4">
                {capaDa(v.imagens) && (
                  <img
                    src={capaDa(v.imagens)!}
                    alt={`Foto de capa da viagem para ${v.destino}`}
                    loading="lazy"
                    className="h-16 w-20 shrink-0 rounded-sm border border-border object-cover sm:h-20 sm:w-28"
                  />
                )}
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-serif text-lg text-foreground">
                    {v.titulo || v.destino}
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
                {v.subtitulo && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {v.subtitulo}
                  </p>
                )}
                <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {v.destino} · Partida {formatarData(v.data_partida)}
                  {v.hora_partida ? ` às ${formatarHora(v.hora_partida)}` : ""} ·
                  Por pessoa{" "}
                  <span className="text-foreground">
                    {formatarValor(v.valor)}
                  </span>{" "}
                  · {v.vagas || 0} vagas
                </p>
                <ViagemCountdown
                  data={v.data_partida}
                  hora={v.hora_partida}
                  className="mt-3"
                />
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
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border pt-3 sm:border-0 sm:pt-0">
                {landingUrl(v) && (
                  <>
                    <HintButton
                      hint="Copia o link de compartilhamento da viagem (mostra a foto de capa, o título e o subtítulo no WhatsApp)."
                      variant="outline"
                      size="icon"
                      onClick={() => void copiarUrl(v)}
                    >
                      {copiado === v.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </HintButton>
                    <HintButton
                      hint="Abre a landing page desta viagem em uma nova aba."
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        window.open(landingUrl(v)!, "_blank", "noopener")
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </HintButton>
                  </>
                )}

                {podeEditar && (
                  <HintButton
                    hint="Edita os dados desta viagem."
                    variant="outline"
                    size="icon"
                    onClick={() => navigate(`/viagens/${v.id}`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </HintButton>
                )}
                {podeExcluir && (
                  <HintButton
                    hint="Exclui esta viagem definitivamente."
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
                  </HintButton>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

    </AppShell>
  );
}
