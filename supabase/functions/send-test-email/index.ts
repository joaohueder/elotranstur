// Edge Function: envio de e-mail de teste usando o SMTP configurado no sistema.
// Deploy na sua instância auto-hospedada:
//   supabase functions deploy send-test-email
//
// Requer as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (padrão do runtime).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Cliente com o token do usuário: valida sessão e papel de admin.
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await asUser.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    // Valida papel de admin. Usa a RPC is_admin e, se ela não existir na
    // instância, cai para a leitura direta da tabela user_roles.
    let isAdmin = false;
    const { data: rpcAdmin, error: adminErr } = await asUser.rpc("is_admin");
    if (adminErr) {
      const { data: papel, error: papelErr } = await asUser
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (papelErr) {
        return json(
          { error: `Falha ao verificar permissões: ${adminErr.message} / ${papelErr.message}` },
          400,
        );
      }
      isAdmin = Boolean(papel);
    } else {
      isAdmin = Boolean(rpcAdmin);
    }
    if (!isAdmin) return json({ error: "Acesso negado: somente administradores" }, 403);


    const { destinatario } = (await req.json()) as { destinatario?: string };
    if (!destinatario) return json({ error: "Informe o destinatário" }, 400);

    // Cliente admin: lê a configuração completa (incluindo a senha).
    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg, error: cfgErr } = await admin
      .from("app_email_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (cfgErr) return json({ error: cfgErr.message }, 400);
    if (!cfg?.smtp_host) {
      return json({ error: "SMTP não configurado. Salve as configurações primeiro." }, 400);
    }

    // A porta 465 exige TLS implícito; 587/25 usam STARTTLS (tls = false).
    // Garantimos isso aqui para evitar erro de conexão por configuração invertida.
    const porta = Number(cfg.smtp_port);
    const tlsImplicito = porta === 465 ? true : Boolean(cfg.smtp_secure) && porta !== 587;

    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtp_host,
        port: porta,
        tls: tlsImplicito,
        auth: cfg.smtp_user
          ? { username: cfg.smtp_user, password: cfg.smtp_password }
          : undefined,
      },
    });


    await client.send({
      from: cfg.from_name
        ? `${cfg.from_name} <${cfg.from_email}>`
        : cfg.from_email,
      to: destinatario,
      replyTo: cfg.reply_to || undefined,
      subject: "Teste de envio · ELO Transporte e Turismo",
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111827">
          <p style="letter-spacing:.28em;font-size:11px;text-transform:uppercase;color:#6b7280;margin:0 0 8px">
            ELO Transporte e Turismo
          </p>
          <h1 style="font-size:22px;margin:0 0 16px">Teste de envio bem-sucedido</h1>
          <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 12px">
            Este é um e-mail de teste enviado a partir das configurações de SMTP do sistema.
            Se você recebeu esta mensagem, o servidor de e-mail está funcionando corretamente.
          </p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">
            Enviado em ${new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      `,
    });

    await client.close();

    return json({ ok: true });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
