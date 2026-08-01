// Edge Function: recuperação de senha própria do sistema.
// Envia o código de 6 dígitos pelo SMTP configurado em Configurações > E-mail.
//
// Deploy na instância auto-hospedada:
//   supabase functions deploy password-reset --no-verify-jwt
//
// Ações (POST JSON): { action: "request" | "verify" | "reset", ... }
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

const CODE_TTL_MIN = 15;
const TOKEN_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;

async function sha256(value: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function gerarCodigo() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

type SmtpCfg = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  ativo?: boolean;
};

// Lê o SMTP salvo em Configurações > E-mail. O override permite testar
// exatamente os valores digitados na tela antes de salvar.
async function carregarSmtp(
  db: ReturnType<typeof admin>,
  override?: Partial<SmtpCfg>,
): Promise<SmtpCfg> {
  const { data, error } = await db
    .from("app_email_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler configuração de e-mail: ${error.message}`);

  const cfg = { ...(data ?? {}), ...(override ?? {}) } as SmtpCfg;
  // Senha em branco no override significa "usar a senha já salva".
  if (!cfg.smtp_password) cfg.smtp_password = data?.smtp_password ?? "";

  if (!cfg.smtp_host || !cfg.from_email) {
    throw new Error(
      "SMTP não configurado. Preencha o servidor e o e-mail remetente em Configurações > E-mail.",
    );
  }
  return cfg;
}

/** E-mails adicionais que recebem cópia (CC) dos envios para a empresa. */
async function carregarCopias(
  db: ReturnType<typeof admin>,
  para: string,
): Promise<string[]> {
  const { data } = await db
    .from("app_empresa")
    .select("email, emails_copia")
    .eq("id", true)
    .maybeSingle();

  const empresa = String(data?.email ?? "").trim().toLowerCase();
  const copias = String(data?.emails_copia ?? "")
    .split(",")
    .map((e: string) => e.trim())
    .filter(Boolean);

  // Só entram em cópia os e-mails destinados à empresa.
  if (!empresa || empresa !== para.trim().toLowerCase()) return [];
  return copias.filter((e) => e.toLowerCase() !== empresa);
}

async function enviarSmtp(
  cfg: SmtpCfg,
  para: string,
  assunto: string,
  html: string,
  cc: string[] = [],
) {
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
    from: cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email,
    to: para,
    cc: cc.length ? cc : undefined,
    replyTo: cfg.reply_to || undefined,
    subject: assunto,
    html,
  });

  await client.close();
}

async function enviarEmail(db: ReturnType<typeof admin>, para: string, codigo: string) {
  const cfg = await carregarSmtp(db);
  if (cfg.ativo === false) {
    throw new Error("O envio de e-mails está desativado em Configurações > E-mail.");
  }

  await enviarSmtp(
    cfg,
    para,
    `${codigo} é o seu código de recuperação · ELO`,
    `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111827">
        <p style="letter-spacing:.28em;font-size:11px;text-transform:uppercase;color:#6b7280;margin:0 0 8px">
          ELO Transporte e Turismo
        </p>
        <h1 style="font-size:22px;margin:0 0 16px">Código de recuperação de senha</h1>
        <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px">
          Use o código abaixo na tela de recuperação para criar uma nova senha.
          Ele expira em ${CODE_TTL_MIN} minutos.
        </p>
        <div style="font-size:32px;letter-spacing:12px;font-weight:700;text-align:center;padding:20px;background:#f3f4f6;border:1px solid #e5e7eb">
          ${codigo}
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">
          Se você não pediu a troca de senha, ignore este e-mail.
        </p>
      </div>
    `,
    await carregarCopias(db, para),
  );
}

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Notifica a empresa (com cópias) sobre um novo lead vindo de uma landing page. */
async function notificarLead(
  db: ReturnType<typeof admin>,
  payload: {
    slug?: string;
    nome?: string;
    whatsapp?: string;
    origem?: string;
    contexto?: Record<string, unknown>;
  },
) {
  const { data: empresa } = await db
    .from("app_empresa")
    .select("nome, email")
    .eq("id", true)
    .maybeSingle();

  const para = String(empresa?.email ?? "").trim();
  if (!para) return { ok: false, motivo: "E-mail da empresa não configurado" };

  const cfg = await carregarSmtp(db);
  if (cfg.ativo === false) return { ok: false, motivo: "Envio de e-mails desativado" };

  let viagem: Record<string, unknown> = {};
  if (payload.slug) {
    const { data } = await db.rpc("landing_viagem", { _slug: payload.slug });
    viagem = (data ?? {}) as Record<string, unknown>;
  }

  const c = payload.contexto ?? {};
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const destino = [viagem.destino, viagem.uf].filter(Boolean).join(" / ");

  const linhas: Array<[string, unknown]> = [
    ["Nome", payload.nome],
    ["WhatsApp", payload.whatsapp],
    ["Origem do lead", payload.origem || "Landing Page"],
    ["Data / hora", agora],
    ["Viagem", viagem.titulo || viagem.destino],
    ["Destino de interesse", destino],
    ["Data de partida", viagem.data_partida],
    ["Página", c.url || payload.slug],
    ["Cidade", [c.cidade, c.regiao, c.pais].filter(Boolean).join(" / ")],
    ["IP", c.ip],
    ["Provedor", c.provedor],
    ["Dispositivo", [c.dispositivo, c.sistema, c.navegador].filter(Boolean).join(" · ")],
    ["Resolução", c.resolucao],
    ["Idioma / fuso", [c.idioma, c.fuso].filter(Boolean).join(" · ")],
    ["Referência (referrer)", c.referrer],
    ["utm_source", c.utm_source],
    ["utm_medium", c.utm_medium],
    ["utm_campaign", c.utm_campaign],
    ["utm_term", c.utm_term],
    ["utm_content", c.utm_content],
    ["fbclid", c.fbclid],
    ["gclid", c.gclid],
    ["Query", c.query],
  ];

  const corpo = linhas
    .filter(([, v]) => String(v ?? "").trim() !== "")
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;white-space:nowrap">${esc(k)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827">${esc(v)}</td>
        </tr>`,
    )
    .join("");

  const digitos = String(payload.whatsapp ?? "").replace(/\D/g, "");
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos;

  await enviarSmtp(
    cfg,
    para,
    `Novo lead: ${payload.nome ?? "sem nome"}${destino ? ` · ${destino}` : ""}`,
    `
      <div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;color:#111827">
        <p style="letter-spacing:.28em;font-size:11px;text-transform:uppercase;color:#6b7280;margin:0 0 8px">
          ELO Transporte e Turismo
        </p>
        <h1 style="font-size:20px;margin:0 0 6px">Novo lead recebido</h1>
        <p style="font-size:13px;color:#374151;margin:0 0 18px">
          Um novo contato foi enviado pelo formulário da landing page.
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">${corpo}</table>
        ${
          digitos.length >= 10
            ? `<p style="margin:20px 0 0">
                 <a href="https://wa.me/${numero}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;display:inline-block;font-size:13px">
                   Falar agora no WhatsApp
                 </a>
               </p>`
            : ""
        }
        <p style="font-size:11px;color:#9ca3af;margin-top:24px">
          Mensagem automática do sistema ELO · ${agora}
        </p>
      </div>
    `,
    await carregarCopias(db, para),
  );

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });



  try {
    const body = (await req.json()) as {
      action?: string;
      email?: string;
      code?: string;
      token?: string;
      password?: string;
      destinatario?: string;
      smtp?: Record<string, unknown>;
    };

    const db = admin();
    const email = (body.email ?? "").trim().toLowerCase();
    const acao = body.action;

    // Teste de envio a partir de Configurações > E-mail (somente admin).
    if (acao === "test") {
      const asUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: {
            headers: { Authorization: req.headers.get("Authorization") ?? "" },
          },
        },
      );

      const { data: userData } = await asUser.auth.getUser();
      if (!userData?.user) return json({ error: "Não autenticado" }, 401);

      const { data: papel } = await asUser
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!papel) {
        return json({ error: "Acesso negado: somente administradores" }, 403);
      }

      const destinatario = (body.destinatario ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatario)) {
        return json({ error: "Informe um destinatário válido." }, 400);
      }

      const cfg = await carregarSmtp(db, body.smtp as Partial<SmtpCfg>);
      await enviarSmtp(
        cfg,
        destinatario,
        "Teste de envio · ELO Transporte e Turismo",
        `
          <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111827">
            <p style="letter-spacing:.28em;font-size:11px;text-transform:uppercase;color:#6b7280;margin:0 0 8px">
              ELO Transporte e Turismo
            </p>
            <h1 style="font-size:22px;margin:0 0 16px">Teste de envio bem-sucedido</h1>
            <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 12px">
              Esta mensagem foi enviada usando o SMTP configurado no sistema
              (${cfg.smtp_host}:${cfg.smtp_port}).
            </p>
            <p style="font-size:12px;color:#9ca3af;margin-top:24px">
              Enviado em ${new Date().toLocaleString("pt-BR")}
            </p>
          </div>
        `,
        await carregarCopias(db, destinatario),
      );

      return json({ ok: true });
    }


    if (acao === "request") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Informe um e-mail válido." }, 400);
      }

      const { data: userId, error: findErr } = await db.rpc(
        "find_user_id_by_email",
        { _email: email },
      );
      if (findErr) return json({ error: findErr.message }, 400);

      // Não revela se o e-mail existe.
      if (!userId) return json({ ok: true });

      const codigo = gerarCodigo();
      const { error: insErr } = await db.from("password_reset_codes").insert({
        user_id: userId,
        email,
        code_hash: await sha256(codigo),
        expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
      });
      if (insErr) return json({ error: insErr.message }, 400);

      await enviarEmail(db, email, codigo);
      return json({ ok: true });
    }

    if (acao === "verify") {
      const code = (body.code ?? "").trim();
      if (!email || code.length !== 6) {
        return json({ error: "Informe o e-mail e os 6 dígitos do código." }, 400);
      }

      const { data: registro, error: selErr } = await db
        .from("password_reset_codes")
        .select("*")
        .eq("email", email)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr) return json({ error: selErr.message }, 400);

      if (!registro || new Date(registro.expires_at) < new Date()) {
        return json({ error: "Código inválido ou expirado." }, 400);
      }
      if (registro.attempts >= MAX_ATTEMPTS) {
        return json(
          { error: "Muitas tentativas. Solicite um novo código." },
          429,
        );
      }

      if (registro.code_hash !== (await sha256(code))) {
        await db
          .from("password_reset_codes")
          .update({ attempts: registro.attempts + 1 })
          .eq("id", registro.id);
        return json({ error: "Código inválido ou expirado." }, 400);
      }

      const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
      const { error: updErr } = await db
        .from("password_reset_codes")
        .update({
          verified_at: new Date().toISOString(),
          reset_token: token,
          expires_at: new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString(),
        })
        .eq("id", registro.id);
      if (updErr) return json({ error: updErr.message }, 400);

      return json({ ok: true, token });
    }

    if (acao === "reset") {
      const token = (body.token ?? "").trim();
      const password = body.password ?? "";
      if (!token) return json({ error: "Sessão de recuperação inválida." }, 400);
      if (password.length < 8) {
        return json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, 400);
      }

      const { data: registro, error: selErr } = await db
        .from("password_reset_codes")
        .select("*")
        .eq("reset_token", token)
        .is("used_at", null)
        .maybeSingle();
      if (selErr) return json({ error: selErr.message }, 400);

      if (!registro || !registro.verified_at || new Date(registro.expires_at) < new Date()) {
        return json(
          { error: "Sessão de recuperação expirada. Solicite um novo código." },
          400,
        );
      }

      const { error: updUserErr } = await db.auth.admin.updateUserById(
        registro.user_id,
        { password },
      );
      if (updUserErr) return json({ error: updUserErr.message }, 400);

      await db
        .from("password_reset_codes")
        .update({ used_at: new Date().toISOString(), reset_token: null })
        .eq("id", registro.id);

      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
