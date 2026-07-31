-- =====================================================================
-- 043 - Visitas: garante o registro completo (cidade, IP, geo e demais)
-- =====================================================================
begin;

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

  -- IP: prioriza o informado pelo cliente (geolocalização) e cai para os headers.
  v_ip := nullif(
    btrim(split_part(coalesce(
      nullif(v_dados->>'ip', ''),
      nullif(v_headers->>'cf-connecting-ip', ''),
      nullif(v_headers->>'x-real-ip', ''),
      nullif(v_headers->>'x-forwarded-for', ''),
      ''
    ), ',', 1)),
    ''
  );

  select id into v_recente
  from public.site_visitas v
  where v.visitor_id = _visitor
    and v.path = coalesce(_path, '/')
    and v.created_at > now() - interval '1 minute'
  order by v.created_at desc
  limit 1;

  if v_recente is not null then
    -- Heartbeat: mantém a visita viva e completa TODOS os campos vazios.
    update public.site_visitas s
       set created_at  = now(),
           updated_at  = now(),
           referrer    = coalesce(nullif(s.referrer, ''), nullif(_referrer, '')),
           ip          = coalesce(nullif(s.ip, ''), v_ip),
           cidade      = coalesce(nullif(s.cidade, ''), nullif(v_dados->>'cidade', '')),
           regiao      = coalesce(nullif(s.regiao, ''), nullif(v_dados->>'regiao', '')),
           pais        = coalesce(nullif(s.pais, ''), nullif(v_dados->>'pais', '')),
           provedor    = coalesce(nullif(s.provedor, ''), nullif(v_dados->>'provedor', '')),
           user_agent  = coalesce(nullif(s.user_agent, ''), nullif(v_dados->>'user_agent', ''), v_headers->>'user-agent'),
           dispositivo = coalesce(nullif(s.dispositivo, ''), nullif(v_dados->>'dispositivo', '')),
           navegador   = coalesce(nullif(s.navegador, ''), nullif(v_dados->>'navegador', '')),
           sistema     = coalesce(nullif(s.sistema, ''), nullif(v_dados->>'sistema', '')),
           idioma      = coalesce(nullif(s.idioma, ''), nullif(v_dados->>'idioma', '')),
           resolucao   = coalesce(nullif(s.resolucao, ''), nullif(v_dados->>'resolucao', '')),
           fuso        = coalesce(nullif(s.fuso, ''), nullif(v_dados->>'fuso', '')),
           query       = coalesce(nullif(s.query, ''), nullif(v_dados->>'query', '')),
           utm_source  = coalesce(nullif(s.utm_source, ''), nullif(v_dados->>'utm_source', '')),
           utm_medium  = coalesce(nullif(s.utm_medium, ''), nullif(v_dados->>'utm_medium', '')),
           utm_campaign= coalesce(nullif(s.utm_campaign, ''), nullif(v_dados->>'utm_campaign', '')),
           utm_term    = coalesce(nullif(s.utm_term, ''), nullif(v_dados->>'utm_term', '')),
           utm_content = coalesce(nullif(s.utm_content, ''), nullif(v_dados->>'utm_content', '')),
           fbclid      = coalesce(nullif(s.fbclid, ''), nullif(v_dados->>'fbclid', '')),
           gclid       = coalesce(nullif(s.gclid, ''), nullif(v_dados->>'gclid', '')),
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
    _visitor,
    coalesce(_path, '/'),
    nullif(_referrer, ''),
    v_ip,
    nullif(v_dados->>'cidade', ''),
    nullif(v_dados->>'regiao', ''),
    nullif(v_dados->>'pais', ''),
    nullif(v_dados->>'provedor', ''),
    coalesce(nullif(v_dados->>'user_agent', ''), v_headers->>'user-agent'),
    nullif(v_dados->>'dispositivo', ''),
    nullif(v_dados->>'navegador', ''),
    nullif(v_dados->>'sistema', ''),
    nullif(v_dados->>'idioma', ''),
    nullif(v_dados->>'resolucao', ''),
    nullif(v_dados->>'fuso', ''),
    nullif(v_dados->>'query', ''),
    nullif(v_dados->>'utm_source', ''),
    nullif(v_dados->>'utm_medium', ''),
    nullif(v_dados->>'utm_campaign', ''),
    nullif(v_dados->>'utm_term', ''),
    nullif(v_dados->>'utm_content', ''),
    nullif(v_dados->>'fbclid', ''),
    nullif(v_dados->>'gclid', ''),
    v_dados || jsonb_strip_nulls(jsonb_build_object('ip', v_ip))
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, jsonb) from public;
grant execute on function public.registrar_visita(text, text, text, jsonb) to anon, authenticated;

commit;
