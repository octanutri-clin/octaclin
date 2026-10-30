\set ON_ERROR_STOP on

-- RLS pode separar comandos (por exemplo, trilha append-only). Validar cada
-- predicado conforme o comando coberto, sem exigir UPDATE/DELETE onde nao existe.
with politicas_tenant as (
  select p.tablename,
         count(*) > 0 and bool_and(
           p.cmd in ('ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE')
           and 'public' = any(p.roles)
           and (
             p.cmd not in ('ALL', 'SELECT', 'UPDATE', 'DELETE')
             or (
               lower(coalesce(p.qual, '')) like '%tenant_id%'
               and lower(coalesce(p.qual, '')) like '%current_setting(''app.tenant_id%'
               and lower(coalesce(p.qual, '')) like '%nullif%'
               and lower(coalesce(p.qual, '')) like '%uuid%'
             )
           )
           and (
             p.cmd not in ('ALL', 'INSERT', 'UPDATE')
             or (
               lower(coalesce(p.with_check, '')) like '%tenant_id%'
               and lower(coalesce(p.with_check, '')) like '%current_setting(''app.tenant_id%'
               and lower(coalesce(p.with_check, '')) like '%nullif%'
               and lower(coalesce(p.with_check, '')) like '%uuid%'
             )
           )
         ) as policy_completa
    from pg_policies p
   where p.schemaname = 'public'
   group by p.tablename
), tabelas_tenant as (
  select c.relname as tabela,
         c.relrowsecurity as rls,
         c.relforcerowsecurity as rls_forcada,
         coalesce(p.policy_completa, false) as policy_completa
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    left join politicas_tenant p on p.tablename = c.relname
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and a.attname = 'tenant_id'
     and not a.attisdropped
), manifesto as (
  select json_build_object(
    'banco', current_database(),
    'role', current_user,
    'migrations', coalesce((
      select json_agg(m.name order by m.timestamp, m.name)
        from public.migrations m
    ), '[]'::json),
    'tabelasPublicas', coalesce((
      select json_agg(c.relname order by c.relname)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind in ('r', 'p')
    ), '[]'::json),
    'tabelasTenant', coalesce((
      select json_agg(json_build_object(
        'tabela', t.tabela,
        'rls', t.rls,
        'rlsForcada', t.rls_forcada,
        'policyCompleta', t.policy_completa
      ) order by t.tabela)
        from tabelas_tenant t
    ), '[]'::json),
    'contagensCriticas', json_build_object(
      'tenants', (select count(*)::text from public.tenants),
      'usuarios', (select count(*)::text from public.usuarios),
      'pacientes', (select count(*)::text from public.pacientes),
      'profissionais', (select count(*)::text from public.profissionais),
      'questionarios', (select count(*)::text from public.questionarios),
      'envios_questionario', (select count(*)::text from public.envios_questionario),
      'respostas_checkin', (select count(*)::text from public.respostas_checkin),
      'resposta_valores', (select count(*)::text from public.resposta_valores),
      'agenda_consultas', (select count(*)::text from public.agenda_consultas),
      'mensagens_notificacao', (select count(*)::text from public.mensagens_notificacao),
      'outbox_eventos', (select count(*)::text from public.outbox_eventos),
      'user_action_logs', (select count(*)::text from public.user_action_logs),
      'consentimentos_lgpd', (select count(*)::text from public.consentimentos_lgpd)
    )
  ) as documento
)
select documento from manifesto;
