-- =====================================================================
-- 051 - AUDITORIA DE SEGURANÇA E BANCO (hardening geral)
-- Banco: Supabase AUTO-HOSPEDADO · idempotente · seguro para reexecutar
--
-- Corrige:
--  [ALTO]  Dados da empresa (e-mail e e-mails em cópia) legíveis por anônimos
--  [ALTO]  Tabela viagens com GRANT SELECT para anônimos
--  [ALTO]  Visitas (IP, cidade, dispositivo) legíveis por QUALQUER usuário logado
--  [ALTO]  landing_lead sem limite de envio (spam) e vazando erro interno do banco
--  [MÉDIO] registrar_visita confiando no IP enviado pelo navegador (falsificável)
--  [MÉDIO] Tabelas de configuração com GRANT de escrita direta (bypass de RPC)
--  [MÉDIO] destinos legíveis por anônimos sem necessidade
--  [BAIXO] Índices ausentes em colunas usadas em filtros/joins
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) EMPRESA: nunca expor e-mails ao público
-- ---------------------------------------------------------------------
revoke select on public.app_empresa from anon;
revoke insert, update on public.app_empresa from authenticated;
grant select on public.app_empresa to authenticated;

drop policy if exists app_empresa_select on public.app_empresa;
create policy app_empresa_select on public.app_empresa
  for select to authenticated using (true);

-- Somente nome e WhatsApp são públicos (usados na landing page).
create or replace function public.empresa_publica()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nome', coalesce(nome, ''),
    'whatsapp', coalesce(whatsapp, '')
  )
  from public.app_empresa
  where id;
$$;

revoke all on function public.empresa_publica() from public;
grant execute on function public.empresa_publica() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) VIAGENS e DESTINOS: sem acesso direto de anônimos
--    (a landing page usa apenas a função landing_viagem)
-- ---------------------------------------------------------------------
revoke select on public.viagens from anon;
revoke select on public.destinos from anon;

drop policy if exists destinos_select on public.destinos;
create policy destinos_select on public.destinos
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 3) VISITAS: dados pessoais (IP/cidade) só para quem vê o Dashboard
-- ---------------------------------------------------------------------
drop policy if exists "visitas legiveis autenticados" on public.site_visitas;
create policy "visitas legiveis dashboard"
  on public.site_visitas for select
  to authenticated
  using (public.is_admin() or public.can('dashboard', 'view'));

-- ---------------------------------------------------------------------
-- 4) CONFIGURAÇÕES SENSÍVEIS: escrita apenas pelas funções validadas
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.app_email_settings from authenticated;
revoke select on public.app_email_settings from authenticated;
revoke insert, update, delete on public.app_meta_ads from authenticated;
revoke select on public.app_meta_ads from authenticated;
revoke insert, update, delete on public.app_layout_settings from authenticated;

-- ---------------------------------------------------------------------
-- 5) LANDING PAGE: limite de envios por IP (anti-spam) + erros genéricos
-- ---------------------------------------------------------------------
create table if not exists public.landing_lead_hits (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  criado_em timestamptz not null default now()
);

create index if not exists landing_lead_hits_ip_idx
  on public.landing_lead_hits (ip, criado_em desc);

revoke all on public.landing_lead_hits from anon, authenticated;
grant all on public.landing_lead_hits to service_role;
alter table public.landing_lead_hits enable row level security;
-- Sem policies: acesso apenas pelas funções SECURITY DEFINER.

create or replace function public.landing_lead(
  _slug     text,
  _nome     text,
  _whatsapp text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_viagem   public.viagens;
  v_stage    uuid;
  v_lead     uuid;
  v_digits   text;
  v_nome     text;
  v_headers  jsonb;
  v_ip       text;
  v_envios   integer;
begin
  -- Sanitização: remove caracteres de controle e limita o tamanho.
  v_nome := btrim(regexp_replace(coalesce(_nome, ''), '[[:cntrl:]]', '', 'g'));
  v_nome := left(v_nome, 120);
  v_digits := left(regexp_replace(coalesce(_whatsapp, ''), '\D', '', 'g'), 15);

  if v_nome = '' or length(v_nome) < 2 or length(v_digits) < 10 then
    return json_build_object('ok', false,
      'message', 'Informe seu nome e um WhatsApp válido com DDD.');
  end if;

  -- IP real (proxy), nunca informado pelo navegador.
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip := coalesce(nullif(btrim(split_part(coalesce(
            nullif(v_headers->>'cf-connecting-ip', ''),
            nullif(v_headers->>'x-real-ip', ''),
            nullif(v_headers->>'x-forwarded-for', ''),
            ''), ',', 1)), ''), 'desconhecido');

  -- Limite: 5 envios por IP a cada 10 minutos.
  delete from public.landing_lead_hits where criado_em < now() - interval '1 day';

  select count(*) into v_envios
  from public.landing_lead_hits
  where ip = v_ip and criado_em > now() - interval '10 minutes';

  if v_envios >= 5 then
    return json_build_object('ok', false,
      'message', 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.');
  end if;

  insert into public.landing_lead_hits (ip) values (v_ip);

  select * into v_viagem
  from public.viagens
  where landing_slug = _slug
    and landing_ativa = true
    and situacao = 'ativa'
  limit 1;

  if not found then
    return json_build_object('ok', false,
      'message', 'Esta viagem não está mais disponível.');
  end if;

  select id into v_stage
  from public.crm_stages
  where ativo = true
  order by posicao asc, created_at asc
  limit 1;

  if v_stage is null then
    insert into public.crm_stages (nome, posicao, ativo)
    values ('Novo Lead', 0, true)
    returning id into v_stage;
  end if;

  insert into public.crm_leads (nome, whatsapp, origem, stage_id, posicao)
  values (
    v_nome,
    case
      when length(v_digits) = 11 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,5) || '-' || substr(v_digits,8,4)
      when length(v_digits) = 10 then '(' || substr(v_digits,1,2) || ') ' || substr(v_digits,3,4) || '-' || substr(v_digits,7,4)
      else v_digits
    end,
    'Landing Page',
    v_stage,
    coalesce((select min(posicao) - 1 from public.crm_leads where stage_id = v_stage), 0)
  )
  returning id into v_lead;

  begin
    insert into public.crm_lead_viagens (lead_id, viagem_id)
    values (v_lead, v_viagem.id)
    on conflict do nothing;
  exception when others then
    null;
  end;

  return json_build_object('ok', true, 'lead_id', v_lead);
exception when others then
  -- Nunca devolver detalhes internos do banco ao público.
  raise warning 'landing_lead falhou: % (%)', sqlerrm, sqlstate;
  return json_build_object('ok', false,
    'message', 'Não foi possível enviar agora. Tente novamente em instantes.');
end;
$$;

revoke all on function public.landing_lead(text, text, text) from public;
grant execute on function public.landing_lead(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) VISITAS: IP sempre do proxy; campos com tamanho limitado
-- ---------------------------------------------------------------------
create or replace function public.registrar_visita(
  _visitor text,
  _path text default '/',
  _referrer text default null,
  _dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recente uuid;
  v_headers jsonb;
  v_ip text;
  v_visitor text;
  v_path text;
  v_ref text;
  v_dados jsonb := coalesce(_dados, '{}'::jsonb);
begin
  v_visitor := left(regexp_replace(coalesce(_visitor, ''), '[^a-zA-Z0-9_-]', '', 'g'), 64);
  if length(v_visitor) < 4 then
    return;
  end if;

  -- Descarta payloads absurdos (proteção contra abuso).
  if length(v_dados::text) > 8000 then
    v_dados := '{}'::jsonb;
  end if;

  v_path := left(coalesce(nullif(_path, ''), '/'), 300);
  v_ref  := left(nullif(_referrer, ''), 500);

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  -- IP SEMPRE do proxy (o navegador não pode mais forjar o IP).
  v_ip := nullif(btrim(split_part(coalesce(
            nullif(v_headers->>'cf-connecting-ip', ''),
            nullif(v_headers->>'x-real-ip', ''),
            nullif(v_headers->>'x-forwarded-for', ''),
            ''), ',', 1)), '');

  v_dados := v_dados - 'ip';

  select id into v_recente
  from public.site_visitas v
  where v.visitor_id = v_visitor
    and v.path = v_path
    and v.created_at > now() - interval '1 minute'
  order by v.created_at desc
  limit 1;

  if v_recente is not null then
    update public.site_visitas s
       set created_at  = now(),
           updated_at  = now(),
           referrer    = coalesce(nullif(s.referrer, ''), v_ref),
           ip          = coalesce(nullif(s.ip, ''), v_ip),
           cidade      = coalesce(nullif(s.cidade, ''), left(nullif(v_dados->>'cidade', ''), 120)),
           regiao      = coalesce(nullif(s.regiao, ''), left(nullif(v_dados->>'regiao', ''), 120)),
           pais        = coalesce(nullif(s.pais, ''), left(nullif(v_dados->>'pais', ''), 120)),
           provedor    = coalesce(nullif(s.provedor, ''), left(nullif(v_dados->>'provedor', ''), 160)),
           user_agent  = coalesce(nullif(s.user_agent, ''), left(nullif(v_dados->>'user_agent', ''), 400), left(v_headers->>'user-agent', 400)),
           dispositivo = coalesce(nullif(s.dispositivo, ''), left(nullif(v_dados->>'dispositivo', ''), 60)),
           navegador   = coalesce(nullif(s.navegador, ''), left(nullif(v_dados->>'navegador', ''), 60)),
           sistema     = coalesce(nullif(s.sistema, ''), left(nullif(v_dados->>'sistema', ''), 60)),
           idioma      = coalesce(nullif(s.idioma, ''), left(nullif(v_dados->>'idioma', ''), 30)),
           resolucao   = coalesce(nullif(s.resolucao, ''), left(nullif(v_dados->>'resolucao', ''), 30)),
           fuso        = coalesce(nullif(s.fuso, ''), left(nullif(v_dados->>'fuso', ''), 60)),
           query       = coalesce(nullif(s.query, ''), left(nullif(v_dados->>'query', ''), 500)),
           utm_source  = coalesce(nullif(s.utm_source, ''), left(nullif(v_dados->>'utm_source', ''), 120)),
           utm_medium  = coalesce(nullif(s.utm_medium, ''), left(nullif(v_dados->>'utm_medium', ''), 120)),
           utm_campaign= coalesce(nullif(s.utm_campaign, ''), left(nullif(v_dados->>'utm_campaign', ''), 120)),
           utm_term    = coalesce(nullif(s.utm_term, ''), left(nullif(v_dados->>'utm_term', ''), 120)),
           utm_content = coalesce(nullif(s.utm_content, ''), left(nullif(v_dados->>'utm_content', ''), 120)),
           fbclid      = coalesce(nullif(s.fbclid, ''), left(nullif(v_dados->>'fbclid', ''), 255)),
           gclid       = coalesce(nullif(s.gclid, ''), left(nullif(v_dados->>'gclid', ''), 255)),
           detalhes    = s.detalhes || v_dados
                          || jsonb_strip_nulls(jsonb_build_object('ip', v_ip))
     where s.id = v_recente;
    return;
  end if;

  insert into public.site_visitas (
    visitor_id, path, referrer, ip, cidade, regiao, pais, provedor,
    user_agent, dispositivo, navegador, sistema, idioma, resolucao, fuso, query,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, detalhes
  ) values (
    v_visitor, v_path, v_ref, v_ip,
    left(nullif(v_dados->>'cidade', ''), 120),
    left(nullif(v_dados->>'regiao', ''), 120),
    left(nullif(v_dados->>'pais', ''), 120),
    left(nullif(v_dados->>'provedor', ''), 160),
    coalesce(left(nullif(v_dados->>'user_agent', ''), 400), left(v_headers->>'user-agent', 400)),
    left(nullif(v_dados->>'dispositivo', ''), 60),
    left(nullif(v_dados->>'navegador', ''), 60),
    left(nullif(v_dados->>'sistema', ''), 60),
    left(nullif(v_dados->>'idioma', ''), 30),
    left(nullif(v_dados->>'resolucao', ''), 30),
    left(nullif(v_dados->>'fuso', ''), 60),
    left(nullif(v_dados->>'query', ''), 500),
    left(nullif(v_dados->>'utm_source', ''), 120),
    left(nullif(v_dados->>'utm_medium', ''), 120),
    left(nullif(v_dados->>'utm_campaign', ''), 120),
    left(nullif(v_dados->>'utm_term', ''), 120),
    left(nullif(v_dados->>'utm_content', ''), 120),
    left(nullif(v_dados->>'fbclid', ''), 255),
    left(nullif(v_dados->>'gclid', ''), 255),
    v_dados || jsonb_strip_nulls(jsonb_build_object('ip', v_ip))
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, text, jsonb) to anon, authenticated;

-- Assinatura antiga (3 parâmetros) não é mais usada pelo sistema.
revoke all on function public.registrar_visita(text, text, text) from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) VALIDAÇÃO NO BANCO (não confiar só no frontend)
-- ---------------------------------------------------------------------
alter table public.crm_leads
  drop constraint if exists crm_leads_nome_valido;
alter table public.crm_leads
  add constraint crm_leads_nome_valido
  check (length(btrim(nome)) between 2 and 120);

alter table public.crm_leads
  drop constraint if exists crm_leads_whatsapp_valido;
alter table public.crm_leads
  add constraint crm_leads_whatsapp_valido
  check (length(regexp_replace(whatsapp, '\D', '', 'g')) between 10 and 15);

alter table public.viagens
  drop constraint if exists viagens_valor_positivo;
alter table public.viagens
  add constraint viagens_valor_positivo check (valor >= 0);

alter table public.viagens
  drop constraint if exists viagens_vagas_positivas;
alter table public.viagens
  add constraint viagens_vagas_positivas check (vagas >= 0);

-- ---------------------------------------------------------------------
-- 8) ÍNDICES (desempenho e escalabilidade)
-- ---------------------------------------------------------------------
create index if not exists crm_leads_stage_pos_idx on public.crm_leads (stage_id, posicao);
create index if not exists crm_leads_created_at_idx on public.crm_leads (created_at desc);
create index if not exists crm_lead_notas_lead_idx on public.crm_lead_notas (lead_id, data_hora desc);
create index if not exists crm_lead_viagens_lead_idx on public.crm_lead_viagens (lead_id);
create index if not exists crm_lead_viagens_viagem_idx on public.crm_lead_viagens (viagem_id);
create index if not exists viagens_situacao_data_idx on public.viagens (situacao, data_partida);
create index if not exists site_visitas_path_idx on public.site_visitas (path, created_at desc);
create index if not exists user_permissions_user_modulo_idx on public.user_permissions (user_id, modulo);
create index if not exists user_roles_user_idx on public.user_roles (user_id);

commit;

-- =====================================================================
-- Depois de rodar: nada muda visualmente, mas o sistema passa a bloquear
-- leitura pública de e-mails da empresa, spam de leads e leitura de
-- visitas por usuários sem permissão no Dashboard.
-- =====================================================================
