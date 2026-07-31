// Edge Function: Meta Ads · API de Conversões (CAPI) + validação do Pixel.
//
// Deploy na instância auto-hospedada:
//   supabase functions deploy meta-capi --no-verify-jwt
//
// Ações (POST JSON):
//   { action: "track", event_name, event_id, event_source_url, user_data?, custom_data? }
//   { action: "validate", pixel_id?, access_token? }   (somente admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function sha256(value: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Normaliza + hasheia conforme exigido pela Meta. */
async function hashNome(nome: string) {
  const limpo = nome.trim().toLowerCase();
  return limpo ? await sha256(limpo) : null;
}

async function hashTelefone(tel: string) {
  let digitos = (tel ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return await sha256(digitos);
}

type Cfg = {
  pixel_id: string;
  access_token: string;
  test_event_code: string;
  ativo: boolean;
};

async function carregarCfg(db: ReturnType<typeof admin>): Promise<Cfg> {
  const { data, error } = await db
    .from("app_meta_ads")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler configuração do Meta Ads: ${error.message}`);
  return {
    pixel_id: String(data?.pixel_id ?? ""),
    access_token: String(data?.access_token ?? ""),
    test_event_code: String(data?.test_event_code ?? ""),
    ativo: Boolean(data?.ativo),
  };
}

async function exigirAdmin(req: Request) {
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
  if (!userData?.user) return { erro: json({ error: "Não autenticado" }, 401) };
  const { data: papel } = await asUser
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!papel) {
    return { erro: json({ error: "Acesso negado: somente administradores" }, 403) };
  }
  return { erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = (await req.json()) as {
      action?: string;
      event_name?: string;
      event_id?: string;
      event_source_url?: string;
      pixel_id?: string;
      access_token?: string;
      user_data?: { nome?: string; whatsapp?: string; fbp?: string; fbc?: string };
      custom_data?: Record<string, unknown>;
    };

    const db = admin();
    const cfg = await carregarCfg(db);

    // ------------------------------------------------ validação (admin)
    if (body.action === "validate") {
      const guard = await exigirAdmin(req);
      if (guard.erro) return guard.erro;

      const pixel = (body.pixel_id || cfg.pixel_id).trim();
      const token = (body.access_token || cfg.access_token).trim();
      if (!pixel) return json({ error: "Informe o ID do Pixel." }, 400);
      if (!token) return json({ error: "Informe o token da API de Conversões." }, 400);

      // 1) O token consegue ler o Pixel?
      const info = await fetch(
        `${GRAPH}/${pixel}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      );
      const infoBody = await info.json().catch(() => ({}));
      if (!info.ok) {
        return json(
          {
            error:
              infoBody?.error?.message ??
              `Falha ao consultar o Pixel (HTTP ${info.status}).`,
            details: infoBody,
          },
          400,
        );
      }

      // 2) O token consegue ENVIAR eventos? (evento de teste)
      const teste = await fetch(
        `${GRAPH}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [
              {
                event_name: "PageView",
                event_time: Math.floor(Date.now() / 1000),
                event_id: `validate-${crypto.randomUUID()}`,
                action_source: "website",
                event_source_url: body.event_source_url ?? "",
                user_data: { client_user_agent: "elo-validation" },
              },
            ],
            ...(cfg.test_event_code || body.custom_data
              ? { test_event_code: cfg.test_event_code || undefined }
              : {}),
          }),
        },
      );
      const testeBody = await teste.json().catch(() => ({}));
      if (!teste.ok) {
        return json(
          {
            error:
              testeBody?.error?.message ??
              `O Pixel foi encontrado, mas o envio de eventos falhou (HTTP ${teste.status}).`,
            details: testeBody,
          },
          400,
        );
      }

      return json({
        ok: true,
        pixel_id: infoBody.id ?? pixel,
        pixel_name: infoBody.name ?? "",
        events_received: testeBody.events_received ?? 1,
      });
    }

    // ------------------------------------------------ envio de evento (público)
    if (body.action === "track") {
      if (!cfg.ativo || !cfg.pixel_id || !cfg.access_token) {
        return json({ ok: false, skipped: "Integração Meta Ads desativada ou incompleta." });
      }

      const nome = body.user_data?.nome ?? "";
      const partes = nome.trim().split(/\s+/);
      const user_data: Record<string, unknown> = {
        client_user_agent: req.headers.get("user-agent") ?? "",
        client_ip_address:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      };
      if (body.user_data?.fbp) user_data.fbp = body.user_data.fbp;
      if (body.user_data?.fbc) user_data.fbc = body.user_data.fbc;

      const ph = await hashTelefone(body.user_data?.whatsapp ?? "");
      if (ph) user_data.ph = [ph];
      if (partes[0]) {
        const fn = await hashNome(partes[0]);
        if (fn) user_data.fn = [fn];
      }
      if (partes.length > 1) {
        const ln = await hashNome(partes.slice(1).join(" "));
        if (ln) user_data.ln = [ln];
      }

      const evento = {
        event_name: body.event_name || "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id || crypto.randomUUID(),
        action_source: "website",
        event_source_url: body.event_source_url ?? "",
        user_data,
        ...(body.custom_data ? { custom_data: body.custom_data } : {}),
      };

      const resp = await fetch(
        `${GRAPH}/${cfg.pixel_id}/events?access_token=${encodeURIComponent(cfg.access_token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: [evento],
            ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
          }),
        },
      );
      const respBody = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("meta-capi erro", resp.status, JSON.stringify(respBody));
        return json(
          {
            ok: false,
            error: respBody?.error?.message ?? `HTTP ${resp.status}`,
          },
          200, // nunca quebra a página pública
        );
      }
      return json({ ok: true, events_received: respBody.events_received ?? 1 });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("meta-capi falhou", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
