-- =====================================================================
-- 042 - Dashboard: detalhamento das visitas (últimas 10 com detalhes)
-- =====================================================================
begin;

-- 1) Novas colunas de detalhe da visita ------------------------------
alter table public.site_visitas
  add column if not exists ip text,
  add column if not exists cidade text,
  add column if not exists regiao text,
  add column if not exists pais text,
  add column if not exists provedor text,
  add column if not exists user_agent text,
  add column if not exists dispositivo text,
  add column if not exists navegador text,
  add column if not exists sistema text,
  add column if not exists idioma text,
  add column if not exists resolucao text,
  add column if not exists fuso text,
  add column if not exists query text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists fbclid text,
  add column if not exists gclid text,
  add column if not exists virou_lead boolean not null default false,
  add column if not exists lead_id uuid references public.crm_leads(id) on delete set null,
  add column if not exists detalhes jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- 2) Registro de visita com detalhes ---------------------------------
drop function if exists public.registrar_visita(text, text, text);

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
  v_dados jsonb := coalesce(_dados, '{}'::jsonb);
begin
  if _visitor is null or length(_visitor) < 4 then
    return;
  end if;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_ip := nullif(split_part(coalesce(v_dados->>'ip', v_headers->>'x-forwarded-for', ''), ',', 1), '');

  select id into v_recente
  from public.site_visitas v
  where v.visitor_id = _visitor
    and v.path = coalesce(_path, '/')
    and v.created_at > now() - interval '1 minute'
  order by v.created_at desc
  limit 1;

  if v_recente is not null then
    -- Heartbeat: mantém a visita "viva" sem duplicar registros.
    update public.site_visitas
       set created_at = now(),
           updated_at = now(),
           ip = coalesce(ip, v_ip),
           cidade = coalesce(cidade, v_dados->>'cidade'),
           regiao = coalesce(regiao, v_dados->>'regiao'),
           pais = coalesce(pais, v_dados->>'pais'),
           provedor = coalesce(provedor, v_dados->>'provedor'),
           detalhes = detalhes || v_dados
     where id = v_recente;
    return;
  end if;

  insert into public.site_visitas (
    visitor_id, path, referrer, ip, cidade, regiao, pais, provedor,
    user_agent, dispositivo, navegador, sistema, idioma, resolucao, fuso, query,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, detalhes
  ) values (
    _visitor,
    coalesce(_path, '/'),
    _referrer,
    v_ip,
    v_dados->>'cidade',
    v_dados->>'regiao',
    v_dados->>'pais',
    v_dados->>'provedor',
    coalesce(v_dados->>'user_agent', v_headers->>'user-agent'),
    v_dados->>'dispositivo',
    v_dados->>'navegador',
    v_dados->>'sistema',
    v_dados->>'idioma',
    v_dados->>'resolucao',
    v_dados->>'fuso',
    v_dados->>'query',
    v_dados->>'utm_source',
    v_dados->>'utm_medium',
    v_dados->>'utm_campaign',
    v_dados->>'utm_term',
    v_dados->>'utm_content',
    v_dados->>'fbclid',
    v_dados->>'gclid',
    v_dados
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, text, jsonb) to anon, authenticated;

-- 3) Marca a visita como convertida em lead --------------------------
create or replace function public.marcar_visita_lead(
  _visitor text,
  _whatsapp text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_lead uuid;
begin
  if _visitor is null then return; end if;

  select id into v_id
  from public.site_visitas
  where visitor_id = _visitor
  order by created_at desc
  limit 1;

  if v_id is null then return; end if;

  if _whatsapp is not null then
    select l.id into v_lead
    from public.crm_leads l
    where regexp_replace(l.whatsapp, '\D', '', 'g') = regexp_replace(_whatsapp, '\D', '', 'g')
    order by l.created_at desc
    limit 1;
  end if;

  update public.site_visitas
     set virou_lead = true,
         lead_id = coalesce(v_lead, lead_id),
         updated_at = now()
   where id = v_id;
end;
$$;

revoke all on function public.marcar_visita_lead(text, text) from public;
grant execute on function public.marcar_visita_lead(text, text) to anon, authenticated;

-- 4) Últimas visitas para o Dashboard --------------------------------
create or replace function public.dashboard_ultimas_visitas(_limite int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if not (public.is_admin() or public.can('dashboard', 'view')) then
    raise exception 'Sem permissão para o módulo Dashboard';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v
  from (
    select
      s.id, s.visitor_id, s.created_at, s.updated_at, s.path, s.referrer,
      s.ip, s.cidade, s.regiao, s.pais, s.provedor,
      s.user_agent, s.dispositivo, s.navegador, s.sistema, s.idioma,
      s.resolucao, s.fuso, s.query,
      s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.utm_content,
      s.fbclid, s.gclid, s.virou_lead, s.lead_id, s.detalhes,
      l.nome as lead_nome, l.whatsapp as lead_whatsapp, l.origem as lead_origem,
      st.nome as lead_etapa
    from public.site_visitas s
    left join public.crm_leads l on l.id = s.lead_id
    left join public.crm_stages st on st.id = l.stage_id
    order by s.created_at desc
    limit greatest(1, least(coalesce(_limite, 10), 100))
  ) x;

  return v;
end;
$$;

revoke all on function public.dashboard_ultimas_visitas(int) from public, anon;
grant execute on function public.dashboard_ultimas_visitas(int) to authenticated;

commit;
