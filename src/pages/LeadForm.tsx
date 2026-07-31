import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";

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
import { ORIGENS, formatWhatsapp, type CrmStage } from "@/lib/crm";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";

export default function LeadForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const feedback = useFeedback();

  const [stages, setStages] = useState<CrmStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [origem, setOrigem] = useState<string>("WhatsApp");
  const [stageId, setStageId] = useState<string>("");

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
      const { error: err } = editando
        ? await supabase.from("crm_leads").update(payload).eq("id", id!)
        : await supabase.from("crm_leads").insert(payload);
      if (err) throw err;

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
        <Button variant="outline" size="icon" onClick={() => navigate("/crm")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Módulo · CRM
          </p>
          <h1 className="mt-1 font-serif text-3xl text-foreground">
            {editando ? "Editar lead" : "Novo lead"}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="max-w-2xl rounded-sm border border-border bg-background p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do lead"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
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
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Etapa do funil</Label>
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

          <div className="mt-8 flex justify-end gap-3 border-t border-border pt-6">
            <Button variant="outline" onClick={() => navigate("/crm")}>
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
