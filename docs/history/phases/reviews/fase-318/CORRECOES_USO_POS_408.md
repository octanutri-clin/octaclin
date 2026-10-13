# Correções de uso após PR408 — 2026-10-13

Base main4aeb5297, worktree isolada. Alteração preexistente next-env do checkout
principal preservada. Sem migration nova, alteração externa, chave real ou
chamada paga. Perfil e piloto sintético não implementados/ativados nesta PR.

## Causa e correções

1. Metas e Adesão500: logs de produção indicaram missing FROM-clause para alias
   badgeorm. Não copiar logs/params reais ao repositório. SQL TypeORM gerado mostrou
   BadgeOrm.regraConquista sem quoting dentro do JSON operator; parênteses permitem
   substituição de alias/coluna. Tenant e exclusão317 preservados. Fonte clínica
   não consultada, nenhuma alteração de flags/limites/consentimentos317.
2. Aviso em Integrações refere-se à API OctaClin/webhooks; texto agora distingue
   da chave OpenAI. Estado ausente não autoriza cadastro. Backend devolve boolean
   cadastroCredencialPermitido derivado estritamente de direitos===true; BFF
   projeta boolean fail-closed. UI bloqueia cadastro, mantém remoção disponível.
   Backend preserva autorização contratual e vínculo/session/CAS existentes.
3. Profissionais exibe drawer de IDs já presentes no DTO autorizado (profissional,
   clínica e usuário). Não amplia API, edição, carteira ou permissões. Sem IDs
   reais em testes/Git. Perfil completo registrado como pendência no roadmap.
4. Erros5xx de gamificação recebem mensagem operacional; JSON interno não é
   mostrado como texto da interface. Status HTTP continua disponível à lógica.

## Evidências efetivamente executadas

- SQL RED1FAIL (consulta gerada sem banco), GREEN19PASS junto às regressões legadas.
- Contrato de cadastro RED3FAIL, GREEN HTTP8PASS; BFF RED1FAIL, GREEN6PASS.
- UI RED de mensagem bloqueada, ausência de drawer e erro JSON; erro de gravação de
  traces por duas execuções locais simultâneas não é RED funcional. Execução final
  sequencial14PASS desktop/mobile, incluindo axe dos fluxos318 existentes.
- Primeiro teste mobile de drawer falhou; limpar cache Next gerado inicialmente
  com cwd incorreto e executar servidor no pacote web resolveu. Não alterar
  componente global de tabela nem afrouxar interação do teste.
- Backend completo2793PASS/99SKIPPED, typecheckPASS.
- Lint das superfícies alteradas:0erros/2warnings preexistentes em componentes
  antigos. BFF6PASS. Builds finais web/backend PASS; typecheck web em conclusão, CI pendente ao registrar candidato.
- Novo testePG de badges: preparado exclusivamente para localhost/serviceCI,
  role sem BYPASSRLS, tenantA/B e modelos317 texto/número. SKIPPED local; CI pendente.
- Revisão técnica focal por agente em contexto separado: sem P1/P2 concreto;
  não repetiu suítes, não é revisão clínica/humana nem autorização operacional.
- Governança local/secrets/diff-check PASS antes do commit; preflight
  PowerShell depende do runnerCI, sem relaxamento do gate.

## Operação e pendências

O login429 deixou de ocorrer segundo o usuário depois de consultas de leitura;
nenhuma senha, contador Redis, bloqueio ou configuração foi alterado. Causa do
429 não comprovada; não declarar desbloqueio manual ou correção de autenticação.

Migration1071 registrada e FORCE RLS/policies confirmadas por leitura nos alvos
já identificados. Consulta administrativa não comprova role efetiva do backend.
Gates clínico/contratual/operacional318 permanecem bloqueados. Piloto somente com
corpus sintético fechado e alvo comprovado; não ativar catálogo/direitos gerais.

Após CI/revisão/merge e publicação autorizada destas correções, o titular poderá
consultar seus identificadores no diretório e continuar a preparação do piloto.
