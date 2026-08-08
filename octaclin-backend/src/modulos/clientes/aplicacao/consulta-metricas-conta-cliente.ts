export const SQL_METRICAS_CONTA_CLIENTE = `select
  (select count(*) from usuarios where tenant_id = $1 and ativo = true) as usuarios_total_ativos,
  (select count(*) from usuarios where tenant_id = $1 and ativo = true and role = 'Client') as usuarios_clientes,
  (select count(*) from usuarios where tenant_id = $1 and ativo = true and role in ('SuperAdmin', 'Professional', 'Collaborator')) as usuarios_profissionais,
  (select count(*) from usuarios where tenant_id = $1 and ativo = true and role = 'Patient') as usuarios_pacientes,
  (select count(*) from usuarios where tenant_id = $1 and ativo = true and role in ('Client', 'Professional', 'Collaborator')) as uso_usuarios_administrativos,
  (select count(*) from pacientes where tenant_id = $1 and arquivado_em is null) as uso_pacientes,
  (select count(*) from mensagens_notificacao where tenant_id = $1 and criado_em >= $2) as uso_mensagens_mes,
  (select count(*) from questionarios where tenant_id = $1 and status <> 'arquivado') as uso_formularios_ativos,
  (select coalesce(sum(tamanho_bytes), 0) from arquivos_midia where tenant_id = $1 and status = 'confirmado') as uso_armazenamento_bytes`;
