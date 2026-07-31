import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Plug, Save, ShieldCheck } from "lucide-react";

import { HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type MetaForm = {
  pixel_id: string;
  access_token: string;
  test_event_code: string;
  ativo: boolean;
};

const VAZIO: MetaForm = {
  pixel_id: "",
  access_token: "",
  test_event_code: "",
  ativo: false,
};

/** Extrai a mensagem real devolvida pela Edge Function. */
async function detalharErroFuncao(error: unknown): Promise<Error> {
  const ctx = (error as { context?: unknown } | null)?.context;
  const base = error instanceof Error ? error.message : String(error);
  if (ctx instanceof Response) {
    let corpo = "";
    try {
      corpo = await ctx.clone().text();
    } catch {
      corpo = "";
    }
    let detalhe = corpo;
    try {
      const p = JSON.parse(corpo) as { error?: string; message?: string };
      detalhe = p.error ?? p.message ?? corpo;
    } catch {
      /* não é JSON */
    }
    return new Error(
      `HTTP ${ctx.status}${detalhe ? `: ${detalhe}` : ""}` || base,
    );
  }
  return error instanceof Error ? error : new Error(base);
}

/** Aba Integração: Meta Ads (Pixel + API de Conversões). Somente admin. */
export function IntegracaoTab() {
  const { isAdmin } = useAuthz();
  const feedback = useFeedback();

  const [form, setForm] = useState<MetaForm>(VAZIO);
  const [tokenDefinido, setTokenDefinido] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_meta_ads_settings");
      if (cancelado) return;
      if (error) {
        feedback.showError(
          "Não foi possível carregar",
          "Erro ao buscar as configurações de integração com o Meta Ads.",
          error,
        );
      } else if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        setTokenDefinido(Boolean(d.access_token_set));
        setForm({
          pixel_id: String(d.pixel_id ?? ""),
          access_token: "",
          test_event_code: String(d.test_event_code ?? ""),
          ativo: Boolean(d.ativo),
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function set<K extends keyof MetaForm>(campo: K, valor: MetaForm[K]) {
    setForm((p) => ({ ...p, [campo]: valor }));
  }

  async function salvar() {
    if (!/^\d{6,}$/.test(form.pixel_id.trim())) {
      feedback.showNegative(
        "ID do Pixel inválido",
        "O ID do Pixel é um número (somente dígitos) copiado do Gerenciador de Eventos da Meta.",
      );
      return;
    }
    if (!tokenDefinido && !form.access_token.trim()) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o token de acesso da API de Conversões do Pixel.",
      );
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.rpc("save_meta_ads_settings", {
        _pixel_id: form.pixel_id.trim(),
        _access_token: form.access_token.trim() || null,
        _test_event_code: form.test_event_code.trim(),
        _ativo: form.ativo,
      });
      if (error) throw error;
      setForm((p) => ({ ...p, access_token: "" }));
      setTokenDefinido(true);
      feedback.showSuccess(
        "Integração salva",
        "As páginas públicas passarão a registrar visualizações e leads no Meta Ads.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar a integração com o Meta Ads.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  async function validar() {
    setValidando(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-capi", {
        body: {
          action: "validate",
          pixel_id: form.pixel_id.trim() || undefined,
          access_token: form.access_token.trim() || undefined,
          event_source_url: window.location.origin,
        },
      });
      if (error) throw await detalharErroFuncao(error);
      const r = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        pixel_name?: string;
        pixel_id?: string;
        events_received?: number;
      };
      if (!r.ok) throw new Error(r.error || "Não foi possível validar o Pixel.");
      feedback.showSuccess(
        "Pixel e API validados",
        `Pixel ${r.pixel_name ? `"${r.pixel_name}" ` : ""}(${r.pixel_id}) respondeu corretamente e recebeu ${
          r.events_received ?? 1
        } evento de teste pela API de Conversões.`,
      );
    } catch (err) {
      feedback.showError(
        "Validação falhou",
        "O ID do Pixel ou o token da API de Conversões não foram aceitos pela Meta. Confira os dados no Gerenciador de Eventos.",
        err,
      );
    } finally {
      setValidando(false);
    }
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Somente administradores podem configurar as integrações do sistema.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
          <Plug className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Meta Ads (Facebook e Instagram)
            <HelpTip texto="Liga o site às campanhas da Meta: cada visita e cada formulário enviado é contado como resultado do anúncio." />
          </p>
          <p className="text-xs text-muted-foreground">
            Registra visualizações de página e leads das páginas públicas pelo
            Pixel (navegador) e pela API de Conversões (servidor), com
            deduplicação automática.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-sm border border-border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 rounded-sm bg-muted/60 p-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Integração ativa
              <HelpTip texto="Quando desligado, nenhum dado é enviado para a Meta." />
            </p>
            <p className="text-xs text-muted-foreground">
              Ative após validar o Pixel e o token.
            </p>
          </div>
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => set("ativo", v)}
            aria-label="Ativar integração com o Meta Ads"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              ID do Pixel
              <HelpTip texto="Número do Pixel, encontrado no Gerenciador de Eventos da Meta (ex.: 123456789012345)." />
            </Label>
            <Input
              className="rounded-sm"
              inputMode="numeric"
              placeholder="123456789012345"
              value={form.pixel_id}
              onChange={(e) =>
                set("pixel_id", e.target.value.replace(/\D/g, ""))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              Token da API de Conversões
              <HelpTip texto="Chave secreta gerada no Gerenciador de Eventos › Configurações › API de Conversões. Fica guardada com segurança e nunca é exibida de novo." />
            </Label>
            <Input
              className="rounded-sm"
              type="password"
              autoComplete="new-password"
              placeholder={tokenDefinido ? "•••••••• (já configurado)" : "EAAG..."}
              value={form.access_token}
              onChange={(e) => set("access_token", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {tokenDefinido
                ? "Deixe em branco para manter o token atual."
                : "Obrigatório para enviar eventos pelo servidor."}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 sm:max-w-xs">
          <Label className="flex items-center gap-1.5 text-xs">
            Código de teste (opcional)
            <HelpTip texto="Use apenas durante os testes: os eventos aparecem na aba 'Testar eventos' da Meta em vez de contar como resultado real." />
          </Label>
          <Input
            className="rounded-sm"
            placeholder="TEST12345"
            value={form.test_event_code}
            onChange={(e) => set("test_event_code", e.target.value)}
          />
        </div>

        <div className="rounded-sm bg-muted/60 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">O que é enviado:</span>{" "}
          <code className="mx-1">PageView</code> ao abrir uma página pública e
          <code className="mx-1">Lead</code> ao enviar o formulário (nome e
          WhatsApp são criptografados antes do envio). A tela de login e o painel
          nunca são rastreados.
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <HintButton
          hint="Confere se o ID do Pixel e o token são válidos e envia um evento de teste para a Meta."
          variant="outline"
          className="w-full rounded-sm sm:w-auto"
          disabled={validando || salvando}
          onClick={() => void validar()}
        >
          {validando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Validar Pixel e API
        </HintButton>
        <HintButton
          hint="Grava o ID do Pixel, o token e o estado da integração."
          className="w-full rounded-sm sm:w-auto sm:min-w-32"
          disabled={salvando || validando}
          onClick={() => void salvar()}
        >
          {salvando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </HintButton>
      </div>

      {tokenDefinido && form.ativo && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5" />
          Integração configurada e ativa nas páginas públicas.
        </p>
      )}
    </div>
  );
}
