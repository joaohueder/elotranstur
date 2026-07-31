import { useEffect, useState } from "react";
import { Loader2, Mail, Save, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, HelpTip, HintButton } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFeedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/lib/use-authz";

type EmailForm = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  ativo: boolean;
};

/**
 * Extrai a mensagem real retornada pela Edge Function.
 * O supabase-js lança FunctionsHttpError sem o corpo; ele fica em `context` (Response).
 */
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
      const parsed = JSON.parse(corpo) as { error?: string; message?: string };
      detalhe = parsed.error ?? parsed.message ?? corpo;
    } catch {
      /* corpo não é JSON */
    }
    const status = `HTTP ${ctx.status}${ctx.statusText ? ` ${ctx.statusText}` : ""}`;
    return new Error(detalhe ? `${status}: ${detalhe}` : `${status}: ${base}`);
  }

  return error instanceof Error ? error : new Error(base);
}


const VAZIO: EmailForm = {
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_secure: true,
  from_name: "ELO Transporte e Turismo",
  from_email: "",
  reply_to: "",
  ativo: false,
};

/** Aba E-mail: configuração do servidor SMTP do sistema (somente admin). */
export function EmailTab() {
  const { isAdmin } = useAuthz();
  const feedback = useFeedback();

  const [form, setForm] = useState<EmailForm>(VAZIO);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testeAberto, setTesteAberto] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_email_settings");
      if (cancelado) return;

      if (error) {
        feedback.showError(
          "Não foi possível carregar",
          "Erro ao buscar as configurações de e-mail do sistema.",
          error,
        );
      } else if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        setSenhaDefinida(Boolean(d.smtp_password_set));
        setForm({
          smtp_host: String(d.smtp_host ?? ""),
          smtp_port: Number(d.smtp_port ?? 587),
          smtp_user: String(d.smtp_user ?? ""),
          smtp_password: "",
          smtp_secure: Boolean(d.smtp_secure),
          from_name: String(d.from_name ?? ""),
          from_email: String(d.from_email ?? ""),
          reply_to: String(d.reply_to ?? ""),
          ativo: Boolean(d.ativo),
        });
      }
      setLoading(false);
    }

    void carregar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function set<K extends keyof EmailForm>(campo: K, valor: EmailForm[K]) {
    setForm((p) => ({ ...p, [campo]: valor }));
  }

  async function salvar() {
    if (!form.smtp_host.trim()) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o servidor SMTP (host) para salvar a configuração.",
      );
      return;
    }
    if (!form.from_email.trim()) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe o e-mail remetente do sistema.",
      );
      return;
    }
    if (!senhaDefinida && !form.smtp_password) {
      feedback.showNegative(
        "Campo obrigatório",
        "Informe a senha do usuário SMTP.",
      );
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.rpc("save_email_settings", {
        _smtp_host: form.smtp_host.trim(),
        _smtp_port: form.smtp_port,
        _smtp_user: form.smtp_user.trim(),
        _smtp_password: form.smtp_password ? form.smtp_password : null,
        _smtp_secure: form.smtp_secure,
        _from_name: form.from_name.trim(),
        _from_email: form.from_email.trim(),
        _reply_to: form.reply_to.trim(),
        _ativo: form.ativo,
      });
      if (error) throw error;

      setForm((p) => ({ ...p, smtp_password: "" }));
      setSenhaDefinida(true);
      feedback.showSuccess(
        "Configurações salvas",
        "As configurações de SMTP do sistema foram atualizadas.",
      );
    } catch (err) {
      feedback.showError(
        "Não foi possível salvar",
        "Ocorreu um erro ao gravar as configurações de e-mail. Verifique os dados e tente novamente.",
        err,
      );
    } finally {
      setSalvando(false);
    }
  }

  async function enviarTeste() {
    const alvo = destinatario.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
      feedback.showNegative(
        "E-mail inválido",
        "Informe um endereço de e-mail válido para receber o teste.",
      );
      return;
    }

    setTestando(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-test-email",
        { body: { destinatario: alvo } },
      );
      if (error) throw await detalharErroFuncao(error);
      if (data && typeof data === "object" && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }


      setTesteAberto(false);
      feedback.showSuccess(
        "E-mail de teste enviado",
        `Enviamos uma mensagem de teste para ${alvo}. Verifique a caixa de entrada e o spam.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const naoPublicada =
        msg.includes("entrypoint") ||
        msg.includes("InvalidWorkerCreation") ||
        msg.includes("BOOT_ERROR") ||
        msg.includes("Function not found");
      feedback.showError(
        "Falha no envio de teste",
        naoPublicada
          ? "A função de envio de e-mail ainda não está publicada no seu servidor Supabase. Peça ao responsável pela infraestrutura para publicar a função 'send-test-email' e tente novamente."
          : "Não foi possível enviar o e-mail de teste. Confira o servidor, a porta, o usuário e a senha do SMTP.",
        err,
      );

    } finally {
      setTestando(false);
    }
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Somente administradores podem visualizar e alterar as configurações de
        e-mail do sistema.
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
    <div className="w-full space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground">
          <Mail className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Servidor de e-mail (SMTP)
            <HelpTip texto="Dados do servidor usado para enviar e-mails automáticos do sistema." />
          </p>
          <p className="text-xs text-muted-foreground">
            Usado para envios transacionais do sistema, como recuperação de
            senha e notificações.
          </p>
        </div>
      </div>

      <div className="rounded-sm border border-border p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Endereço do servidor que envia os e-mails, fornecido pelo seu provedor de e-mail."
            >
              Servidor SMTP
            </FieldLabel>
            <Input
              className="rounded-sm"
              placeholder="smtp.seudominio.com"
              value={form.smtp_host}
              onChange={(e) => set("smtp_host", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Número da porta de conexão com o servidor SMTP, geralmente 587 ou 465."
            >
              Porta
            </FieldLabel>
            <Input
              className="rounded-sm"
              type="number"
              min={1}
              max={65535}
              value={form.smtp_port}
              onChange={(e) => set("smtp_port", Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-sm border border-border px-4 py-3 sm:mt-6">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                Conexão segura
                <HelpTip texto="Ativa a criptografia SSL/TLS na conexão com o servidor de e-mail." />
              </p>
              <p className="text-xs text-muted-foreground">SSL / TLS</p>
            </div>
            <Switch
              checked={form.smtp_secure}
              onCheckedChange={(v) => set("smtp_secure", v)}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Login usado para autenticar no servidor de e-mail (geralmente o próprio e-mail)."
            >
              Usuário
            </FieldLabel>
            <Input
              className="rounded-sm"
              autoComplete="off"
              placeholder="usuario@seudominio.com"
              value={form.smtp_user}
              onChange={(e) => set("smtp_user", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Senha do usuário SMTP. Fica guardada de forma segura no sistema."
            >
              Senha
            </FieldLabel>
            <Input
              className="rounded-sm"
              type="password"
              autoComplete="new-password"
              placeholder={senhaDefinida ? "•••••••• (mantida)" : "Informe a senha"}
              value={form.smtp_password}
              onChange={(e) => set("smtp_password", e.target.value)}
            />
            {senhaDefinida && (
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco para manter a senha atual.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Nome que aparece para quem recebe os e-mails enviados pelo sistema."
            >
              Nome do remetente
            </FieldLabel>
            <Input
              className="rounded-sm"
              value={form.from_name}
              onChange={(e) => set("from_name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Endereço de e-mail que aparece como remetente das mensagens enviadas."
            >
              E-mail do remetente
            </FieldLabel>
            <Input
              className="rounded-sm"
              type="email"
              placeholder="nao-responda@seudominio.com"
              value={form.from_email}
              onChange={(e) => set("from_email", e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="E-mail para onde vão as respostas, caso diferente do remetente."
            >
              Responder para (opcional)
            </FieldLabel>
            <Input
              className="rounded-sm"
              type="email"
              placeholder="contato@seudominio.com"
              value={form.reply_to}
              onChange={(e) => set("reply_to", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-sm border border-border px-4 py-3 sm:col-span-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                Envio de e-mails ativo
                <HelpTip texto="Liga ou desliga o envio de e-mails pelo sistema usando este servidor." />
              </p>
              <p className="text-xs text-muted-foreground">
                Se desativado, o sistema não utilizará este servidor SMTP.
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => set("ativo", v)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <HintButton
          hint="Abre a janela para enviar um e-mail de teste e verificar se o SMTP está funcionando."
          variant="outline"
          className="w-full rounded-sm sm:w-auto"
          disabled={salvando || testando}
          onClick={() => {
            setDestinatario(form.from_email);
            setTesteAberto(true);
          }}
        >
          <SendHorizonal className="mr-2 h-4 w-4" />
          Testar envio
        </HintButton>
        <HintButton
          hint="Grava as configurações de e-mail do sistema."
          className="w-full rounded-sm sm:w-auto sm:min-w-32"
          disabled={salvando}
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

      <Dialog open={testeAberto} onOpenChange={setTesteAberto}>
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Testar envio de e-mail</DialogTitle>
            <DialogDescription>
              Enviaremos uma mensagem de teste usando as configurações de SMTP
              já salvas no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <FieldLabel
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
              help="Endereço de e-mail que receberá a mensagem de teste."
            >
              Enviar para
            </FieldLabel>
            <Input
              className="rounded-sm"
              type="email"
              placeholder="destinatario@email.com"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <HintButton
              hint="Fecha esta janela sem enviar o e-mail de teste."
              variant="outline"
              className="w-full rounded-sm sm:w-auto"
              disabled={testando}
              onClick={() => setTesteAberto(false)}
            >
              Cancelar
            </HintButton>
            <HintButton
              hint="Envia um e-mail de teste para o endereço informado."
              className="w-full rounded-sm sm:w-auto"
              disabled={testando}
              onClick={() => void enviarTeste()}
            >
              {testando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="mr-2 h-4 w-4" />
              )}
              Enviar teste
            </HintButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
