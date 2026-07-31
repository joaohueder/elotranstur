import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MapPin,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel, HelpTip, HintButton } from "@/components/help";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatWhatsapp,
  useCrmOrigens,
  type CrmLeadNota,
  type CrmStage,
} from "@/lib/crm";
import { useConfirm } from "@/lib/confirm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { ViagemCountdown } from "@/components/viagem-countdown";
import {
  capaDa,
  formatarData,
  formatarHora,
  formatarValor,
  type Viagem,
} from "@/lib/viagens";

type ViagemOpcao = Pick<
  Viagem,
  | "id"
  | "titulo"
  | "subtitulo"
  | "destino"
  | "data_partida"
  | "hora_partida"
  | "valor"
  | "vagas"
  | "itens_inclusos"
  | "imagens"
  | "situacao"
>;


export default function LeadForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const feedback = useFeedback();

  const { origens } = useCrmOrigens(true);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("dados");

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [origem, setOrigem] = useState<string>("WhatsApp");
  const [stageId, setStageId] = useState<string>("");

  const [viagens, setViagens] = useState<ViagemOpcao[]>([]);
  const [viagensInteresse, setViagensInteresse] = useState<string[]>([]);
  const [viagemSelecionada, setViagemSelecionada] = useState<string>("");

  const [notas, setNotas] = useState<CrmLeadNota[]>([]);
  const [novaNotaDescricao, setNovaNotaDescricao] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const { data: sData, error: sErr } = await supabase
          .from("crm_stages")
          .select("id, nome, cor, posicao, ativo")
          .eq("ativo", true)
          .order("posicao", { ascending: true });
        if (sErr) throw sErr;
        if (!ativo) return;
        const lista = (sData ?? []) as CrmStage[];
        setStages(lista);

        const { data: vData, error: vErr } = await supabase
          .from("viagens")
          .select(
            "id, titulo, subtitulo, destino, data_partida, hora_partida, valor, vagas, itens_inclusos, imagens, situacao",
          )
          .order("data_partida", { ascending: true });
        if (vErr) throw vErr;
        if (!ativo) return;
        setViagens((vData ?? []) as ViagemOpcao[]);

        if (id) {
          const { data, error: err } = await supabase
            .from("crm_leads")
            .select("nome, whatsapp, origem, stage_id")
            .eq("id", id)
            .maybeSingle();
          if (err) throw err;
          if (!ativo) return;
          if (data) {
            setNome(data.nome ?? "");
            setWhatsapp(formatWhatsapp(data.whatsapp ?? ""));
            setOrigem(data.origem ?? "Outros");
            setStageId(data.stage_id ?? lista[0]?.id ?? "");
          }

          const { data: lvData, error: lvErr } = await supabase
            .from("crm_lead_viagens")
            .select("viagem_id")
            .eq("lead_id", id);
          if (lvErr) throw lvErr;
          if (!ativo) return;
          setViagensInteresse(
            (lvData ?? []).map((r: { viagem_id: string }) => r.viagem_id),
          );

          await carregarNotas(id);
        } else {
          setStageId(lista[0]?.id ?? "");
        }
      } catch (err) {
        feedback.showError(
          "Não foi possível carregar",
          "Ocorreu um erro ao carregar os dados do lead.",
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

  async function carregarNotas(leadId: string) {
    const { data, error } = await supabase
      .from("crm_lead_notas")
      .select("id, lead_id, data_hora, descricao, created_by, created_at, updated_at")
      .eq("lead_id", leadId)
      .order("data_hora", { ascending: false });
    if (error) throw error;
    setNotas((data ?? []) as CrmLeadNota[]);
  }

  function validarDadosLead(): boolean {
    if (!nome.trim()) {
      feedback.showNegative("Campo obrigatório", "Informe o nome do lead.");
      setAbaAtiva("dados");
      return false;
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      feedback.showNegative(
        "WhatsApp inválido",
        "Informe um número de WhatsApp válido com DDD.",
      );
      setAbaAtiva("dados");
      return false;
    }
    if (!stageId) {
      feedback.showNegative("Etapa obrigatória", "Selecione a etapa do funil.");
      setAbaAtiva("dados");
      return false;
    }
    return true;
  }

  async function salvar() {
    if (!validarDadosLead()) return;

    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        origem,
        stage_id: stageId,
      };
      let leadId = id ?? "";
      if (editando) {
        const { error: err } = await supabase
          .from("crm_leads")
          .update(payload)
          .eq("id", id!);
        if (err) throw err;
      } else {
        const { data: novo, error: err } = await supabase
          .from("crm_leads")
          .insert(payload)
          .select("id")
          .single();
        if (err) throw err;
        leadId = novo!.id as string;
      }

      const { error: delErr } = await supabase
        .from("crm_lead_viagens")
        .delete()
        .eq("lead_id", leadId);
      if (delErr) throw delErr;

      if (viagensInteresse.length > 0) {
        const { error: insErr } = await supabase
          .from("crm_lead_viagens")
          .insert(
            viagensInteresse.map((viagemId) => ({
              lead_id: leadId,
              viagem_id: viagemId,
            })),
          );
        if (insErr) throw insErr;
      }

      feedback.showSuccess(
        editando ? "Lead atualizado" : "Lead cadastrado",
        `${payload.nome} foi ${editando ? "atualizado" : "cadastrado"} com sucesso.`,
      );
      navigate("/crm");
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar o lead. Tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarNota() {
    if (!novaNotaDescricao.trim()) {
      feedback.showNegative("Descrição obrigatória", "Informe o conteúdo da nota.");
      return;
    }
    if (!id) {
      feedback.showNegative(
        "Lead não salvo",
        "Salve o lead antes de adicionar notas.",
      );
      setAbaAtiva("dados");
      return;
    }

    setSalvandoNota(true);
    try {
      const { error } = await supabase.from("crm_lead_notas").insert({
        lead_id: id,
        data_hora: new Date().toISOString(),
        descricao: novaNotaDescricao.trim(),
      });
      if (error) throw error;

      setNovaNotaDescricao("");
      await carregarNotas(id);
      feedback.showSuccess("Nota adicionada", "A anotação foi salva no histórico do lead.");
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar a nota",
        "Ocorreu um erro ao gravar a anotação.",
        err,
      );
    } finally {
      setSalvandoNota(false);
    }
  }

  async function excluirNota(notaId: string) {
    if (!id) return;
    try {
      const { error } = await supabase
        .from("crm_lead_notas")
        .delete()
        .eq("id", notaId);
      if (error) throw error;
      await carregarNotas(id);
      feedback.showSuccess("Nota removida", "A anotação foi excluída do histórico.");
    } catch (err) {
      feedback.showError(
        "Não foi possível excluir",
        "Ocorreu um erro ao remover a anotação.",
        err,
      );
    }
  }

  function formatarDataHoraNota(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const viagensInteresseAtivas = viagensInteresse
    .map((vid) => viagens.find((x) => x.id === vid))
    .filter(
      (v): v is ViagemOpcao =>
        v !== undefined && v.situacao === "ativa",
    )
    .sort((a, b) =>
      `${a.data_partida}T${a.hora_partida || "00:00"}`.localeCompare(
        `${b.data_partida}T${b.hora_partida || "00:00"}`,
      ),
    );

  return (
    <AppShell>
      <div className="mb-8 flex items-center gap-4">
        <HintButton
          hint="Volta para a lista de leads do CRM sem salvar"
          variant="outline"
          size="icon"
          onClick={() => navigate("/crm")}
        >
          <ArrowLeft className="h-4 w-4" />
        </HintButton>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · CRM
          </p>
          <h1 className="mt-1 flex items-center gap-1.5 font-serif text-3xl text-foreground">
            {editando ? "Editar lead" : "Novo lead"}
            <HelpTip texto="Cadastro de um lead: um contato interessado que ainda vai virar cliente" />
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="w-full rounded-sm border border-border bg-background p-6">
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="dados">Dados do Lead</TabsTrigger>
              <TabsTrigger value="viagens">Viagens de Interesse</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel
                    htmlFor="nome"
                    help="Nome completo do lead, para identificá-lo no funil"
                  >
                    Nome
                  </FieldLabel>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do lead"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <FieldLabel
                    htmlFor="whatsapp"
                    help="Número de WhatsApp com DDD, usado para contato"
                  >
                    WhatsApp
                  </FieldLabel>
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <FieldLabel help="Como esse lead chegou até você, ex.: WhatsApp, site, indicação">
                    Origem
                  </FieldLabel>
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {origens.map((o) => (
                        <SelectItem key={o.id} value={o.nome}>
                          {o.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel help="Fase atual do lead dentro do funil de vendas do CRM">
                    Etapa do funil
                  </FieldLabel>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="viagens" className="space-y-5">
              <div>
                <FieldLabel help="Viagens que interessam a esse lead. Você pode adicionar quantas quiser">
                  Viagens de interesse
                </FieldLabel>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={viagemSelecionada}
                    onValueChange={setViagemSelecionada}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma viagem" />
                    </SelectTrigger>
                    <SelectContent>
                      {viagens
                        .filter(
                          (v) =>
                            v.situacao === "ativa" &&
                            !viagensInteresse.includes(v.id),
                        )
                        .sort((a, b) =>
                          `${a.data_partida}T${a.hora_partida || "00:00"}`.localeCompare(
                            `${b.data_partida}T${b.hora_partida || "00:00"}`,
                          ),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.destino} · {formatarData(v.data_partida)} ·{" "}
                            {formatarHora(v.hora_partida)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <HintButton
                    type="button"
                    hint="Adiciona a viagem selecionada à lista de interesses do lead"
                    variant="outline"
                    disabled={!viagemSelecionada}
                    onClick={() => {
                      if (!viagemSelecionada) return;
                      setViagensInteresse((atual) =>
                        atual.includes(viagemSelecionada)
                          ? atual
                          : [...atual, viagemSelecionada],
                      );
                      setViagemSelecionada("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </HintButton>
                </div>

                {viagensInteresseAtivas.length === 0 ? (
                  <p className="mt-3 rounded-sm border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma viagem adicionada. Selecione acima as viagens que o
                    lead quer conhecer.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {viagensInteresseAtivas.map((v) => {
                      const capa = capaDa(v.imagens);
                      const itens = v.itens_inclusos ?? [];

                      return (
                        <li
                          key={v.id}
                          className="flex gap-3 rounded-sm border border-border bg-muted/20 p-3"
                        >
                          <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-sm border border-border bg-muted sm:block">
                            {capa ? (
                              <img
                                src={capa}
                                alt={`Foto de capa da viagem para ${v.destino}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <MapPin className="h-5 w-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {v.titulo?.trim() || v.destino}
                                </p>
                                {v.titulo?.trim() ? (
                                  <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <MapPin className="mr-1 inline h-3 w-3" />
                                    {v.destino}
                                  </p>
                                ) : null}
                                {v.subtitulo?.trim() ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {v.subtitulo}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <HintButton
                                  type="button"
                                  hint="Remove esta viagem da lista de interesses do lead"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setViagensInteresse((atual) =>
                                      atual.filter((x) => x !== v.id),
                                    )
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </HintButton>
                              </div>
                            </div>

                            <div className="mt-2">
                              <ViagemCountdown
                                data={v.data_partida}
                                hora={v.hora_partida}
                              />
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatarData(v.data_partida)}
                                {v.hora_partida
                                  ? ` às ${formatarHora(v.hora_partida)}`
                                  : ""}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Wallet className="h-3 w-3" />
                                {formatarValor(v.valor ?? 0)} por pessoa
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {v.vagas ?? 0} vagas
                              </span>
                            </div>

                            {itens.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {itens.slice(0, 4).map((item, i) => (
                                  <span
                                    key={`${v.id}-${i}`}
                                    className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {item}
                                  </span>
                                ))}
                                {itens.length > 4 ? (
                                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    +{itens.length - 4} itens
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notas" className="space-y-5">
              <div className="rounded-sm border border-border bg-muted/20 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <StickyNote className="h-4 w-4" />
                  Nova anotação
                  <HelpTip texto="Registre contatos, observações ou qualquer informação importante sobre o lead. A data/hora ajuda a reconstruir o histórico." />
                </h3>
                <div className="grid gap-4 sm:grid-cols-[280px_1fr]">
                  <div>
                    <FieldLabel help="Momento em que a anotação foi feita. É preenchida automaticamente com a data/hora atual no momento do salvamento">
                      Data e hora
                    </FieldLabel>
                    <div className="mt-1.5 flex h-9 items-center rounded-sm border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Será registrado automaticamente no momento do salvamento
                    </div>
                  </div>
                  <div>
                    <FieldLabel help="Texto livre com o registro da conversa, observação ou próximo passo">
                      Descrição
                    </FieldLabel>
                    <Textarea
                      value={novaNotaDescricao}
                      onChange={(e) => setNovaNotaDescricao(e.target.value)}
                      placeholder="Digite aqui a anotação sobre o lead..."
                      className="mt-1.5 min-h-[80px] resize-y"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <HintButton
                    type="button"
                    hint="Salva a anotação no histórico deste lead"
                    onClick={adicionarNota}
                    disabled={salvandoNota}
                  >
                    {salvandoNota ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Adicionar nota
                  </HintButton>
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  Histórico de notas
                  <HelpTip texto="Todas as anotações deste lead, da mais recente para a mais antiga" />
                </h3>

                {notas.length === 0 ? (
                  <p className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma nota registrada para este lead.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {notas.map((nota) => (
                      <li
                        key={nota.id}
                        className="rounded-sm border border-border bg-background p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {formatarDataHoraNota(nota.data_hora)}
                            </span>
                          </div>
                          <HintButton
                            type="button"
                            hint="Remove esta anotação permanentemente"
                            variant="ghost"
                            size="icon"
                            onClick={() => excluirNota(nota.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </HintButton>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                          {nota.descricao}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex justify-end gap-3 border-t border-border pt-6">
            <HintButton
              hint="Descarta as alterações e volta para a lista de leads"
              variant="outline"
              onClick={() => navigate("/crm")}
            >
              Cancelar
            </HintButton>
            <HintButton
              hint="Grava os dados do lead no sistema"
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
