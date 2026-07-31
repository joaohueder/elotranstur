import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { FieldLabel, HelpTip, HintButton } from "@/components/help";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatWhatsapp, useCrmOrigens, type CrmStage } from "@/lib/crm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";

type ViagemOpcao = {
  id: string;
  destino: string;
  data_partida: string;
  situacao: string;
};

function formatarData(iso: string) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function LeadForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const feedback = useFeedback();

  const { origens } = useCrmOrigens(true);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [origem, setOrigem] = useState<string>("WhatsApp");
  const [stageId, setStageId] = useState<string>("");
  const [viagens, setViagens] = useState<ViagemOpcao[]>([]);
  const [viagensInteresse, setViagensInteresse] = useState<string[]>([]);
  const [viagemSelecionada, setViagemSelecionada] = useState<string>("");

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
          .select("id, destino, data_partida, situacao")
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
          setViagensInteresse((lvData ?? []).map((r: { viagem_id: string }) => r.viagem_id));
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

  async function salvar() {
    if (!nome.trim()) {
      feedback.showNegative("Campo obrigatório", "Informe o nome do lead.");
      return;
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      feedback.showNegative(
        "WhatsApp inválido",
        "Informe um número de WhatsApp válido com DDD.",
      );
      return;
    }
    if (!stageId) {
      feedback.showNegative("Etapa obrigatória", "Selecione a etapa do funil.");
      return;
    }

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
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="nome" help="Nome completo do lead, para identificá-lo no funil">
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
              <FieldLabel htmlFor="whatsapp" help="Número de WhatsApp com DDD, usado para contato">
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

            <div className="sm:col-span-2">
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
                      .filter((v) => !viagensInteresse.includes(v.id))
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.destino} · {formatarData(v.data_partida)}
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

              {viagensInteresse.length === 0 ? (
                <p className="mt-3 rounded-sm border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhuma viagem adicionada. Selecione acima as viagens que o
                  lead quer conhecer.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {viagensInteresse.map((vid) => {
                    const v = viagens.find((x) => x.id === vid);
                    return (
                      <li
                        key={vid}
                        className="flex items-center justify-between gap-3 rounded-sm border border-border bg-muted/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {v?.destino ?? "Viagem removida"}
                          </p>
                          {v ? (
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              Partida em {formatarData(v.data_partida)} ·{" "}
                              {v.situacao}
                            </p>
                          ) : null}
                        </div>
                        <HintButton
                          type="button"
                          hint="Remove esta viagem da lista de interesses do lead"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setViagensInteresse((atual) =>
                              atual.filter((x) => x !== vid),
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </HintButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

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
