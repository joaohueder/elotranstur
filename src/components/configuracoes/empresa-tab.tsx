import { useEffect, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";

import { FieldLabel, HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type EmpresaForm = { nome: string; whatsapp: string; email: string };

const VAZIO: EmpresaForm = { nome: "", whatsapp: "", email: "" };


/** Máscara (00) 00000-0000 */
function mascaraWhatsapp(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Aba Empresa: dados cadastrais básicos da empresa. */
export function EmpresaTab() {
  const { can, isAdmin } = useAuthz();
  const feedback = useFeedback();

  const podeEditar = isAdmin || can("configuracoes", "edit");

  const [form, setForm] = useState<EmpresaForm>(VAZIO);
  const [original, setOriginal] = useState<EmpresaForm>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const { data, error } = await supabase
        .from("app_empresa")
        .select("nome, whatsapp")
        .maybeSingle();
      if (cancelado) return;

      if (error) {
        feedback.showError(
          "Não foi possível carregar",
          "Erro ao buscar os dados da empresa.",
          error,
        );
      } else if (data) {
        const carregado = {
          nome: String(data.nome ?? ""),
          whatsapp: mascaraWhatsapp(String(data.whatsapp ?? "")),
        };
        setForm(carregado);
        setOriginal(carregado);
      }
      setLoading(false);
    }

    void carregar();

    const canal = supabase
      .channel("app_empresa_config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_empresa" },
        () => void carregar(),
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alterado =
    form.nome !== original.nome || form.whatsapp !== original.whatsapp;

  async function salvar() {
    if (!form.nome.trim()) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o nome da empresa para salvar.",
      );
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.rpc("save_empresa_settings", {
        _nome: form.nome.trim(),
        _whatsapp: form.whatsapp.trim(),
      });
      if (error) throw error;

      setOriginal({ ...form });
      feedback.showSuccess(
        "Dados salvos",
        "As informações da empresa foram atualizadas com sucesso.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar os dados da empresa. Tente novamente.",
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
    <div className="w-full space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
          <Building2 className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Dados da empresa
            <HelpTip texto="Informações da sua empresa usadas em telas, e-mails e páginas públicas." />
          </p>
          <p className="text-xs text-muted-foreground">
            Cadastre aqui as informações básicas de identificação da empresa.
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-border p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Nome da empresa como deve aparecer para os clientes."
            >
              Nome da empresa
            </FieldLabel>
            <Input
              className="rounded-sm"
              placeholder="ELO Transporte e Turismo"
              value={form.nome}
              disabled={!podeEditar}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Número de WhatsApp de contato da empresa, com DDD."
            >
              WhatsApp
            </FieldLabel>
            <Input
              className="rounded-sm"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={form.whatsapp}
              disabled={!podeEditar}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  whatsapp: mascaraWhatsapp(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </div>

      {!podeEditar ? (
        <p className="text-xs text-muted-foreground">
          Você tem apenas permissão de visualização neste módulo.
        </p>
      ) : (
        <div className="flex justify-end">
          <HintButton
            hint="Grava os dados da empresa no sistema."
            className="rounded-sm"
            onClick={() => void salvar()}
            disabled={!alterado || salvando}
          >
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar dados da empresa
          </HintButton>
        </div>
      )}
    </div>
  );
}
