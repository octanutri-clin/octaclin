# Ledger — plano: tasks/todo-fase-318.md

Base8ea67a08; planejamento atédfd19518; execução autorizada2026-10-13.
RiscoR4: PHI/credencial/tenant/schema. Nenhuma mudança externa autorizada.

Pre-flight: T04 fornece contexto/gates para T05/T06; contexto fora de lock durante
await exige revalidação monotônica. T06 usa builder transacional da evolução.
Ruling: scripts cloud da skill não têm caminho executor local; ledger versionado
neste documento e logs próprios em /tmp/f318-evidencias preservam decisões.
Ruling: espaço218MB impede Timescale local; PG deve ser comprovado no CI
com fixture descartável, sem usar bancos de staging/produção ou simular Timescale.
Ruling: catálogo assistencial sem modelos ratificados; default vazio.
Catálogo sintético injetado somente em teste, sem env de mock em produção.
G01/G02BLOCKED; permissões de produto não os fecham. Nenhum provedor real chamado.

## T01–T03
Corpus documental30casos disponível; executar harness com saídas sintéticas/mock
não valida qualidade de OpenAI nem revisão humana. Criar mecanismo reproduzível,
sem marcar comparação clínica comoPASS ou escolher modelo por plausibilidade.

## T04 em andamento
Domínio/provas/DTOs e testesRED antes do código. Próximo: contratos de fontes,
criptografia/contexto/limites e gate efetivo de provider bloqueado por padrão.

### Fundamentos comprovados
Node22.23.3 oficial/hash df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de.
Toolchain antigo ausente: primeira invocação pnpm falhou por ambiente, não RED.
Arquivo inicial removido; esqueletos compiláveis permitiram RED funcional antes
dos corpos: domínio14FAIL; schema2FAIL; adaptador5FAIL/1PASS. O teste de erro
externo tinha falso positivo no esqueleto e foi fortalecido para exigir rejeição;
não declarar esse1PASS como prova de sanitização. GREEN22tests antes da força
adicional; repetir na próxima rodada. Nenhum fetch real chamado.
Ruling: geração monotônica por triggersBEFOREUPDATE nos três escritores canônicos
(pacientes/profissionais/usuarios), protegendo contador contra downgrade e cobrindo
caminhos SQL/ORM. Migration1071 aditiva registrada; nenhuma migration externa.
Ruling: catálogo vazio e direitosBYOK false no provider de produção; injeção
sintética só nos testes. Variáveis/cliente não aprovam protocolo ou contrato.
Prova PG ainda pendente; testes de SQL/mock não fecham RLS/concorrência.

## Incrementos seguintes

- Credencial/CAS: RED5FAIL → GREEN; schema corrupto/limites: RED2FAIL → GREEN.
- Builder compartilhado de evolução na mesma transação: RED1FAIL → GREEN;
  regressão pacientes99testes PASS. Fluxo manual conserva seu contrato.
- Projeções de fontes: RED2FAIL → GREEN. Geração/contexto/nonce: RED4FAIL → GREEN.
- Confirmação: RED4FAIL → GREEN8tests serviço; domínio/schema26tests PASS.
- Contrato de nota atual e replay confirmado após TTL: RED funcional registrado;
  replay permanece condicionado à autorização e versões vigentes.
- Adapter endurecido: RED3FAIL → GREEN10tests, modelo retornado pinado/status
  sanitizados. Nenhum fetch real. HTTP3tests PASS (primeiro RED era compilação,
  não vulnerabilidade reproduzida); não exagerar essa evidência.
- BFF: esqueleto200 produziu RED2FAIL → GREEN2tests; origem/role/allowlist/no-store.
- Auditoria transacional: RED1FAIL → GREEN16tests contexto/serviço; sem segredo/
  texto clínico em metadados. Rotas administrativas não acessam fontes ou chaves.
- Suíte backend executada no cwd correto:2775PASS/91SKIPPED (inclui5PG318
  pendentes). Invocação anterior no cwd raiz produziu ENOENT da ficha313;
  resolvido pelo comando correto, sem alterar a outra fase.
- Node22 direto evita reinstalação pnpm11.19 incompatível. Dependências idênticas
  à base reaproveitadas por symlink local/ignorado, sem alteração de lockfiles.
- Harness Python offline2tests PASS;30casos/relatório/hash produzidos. Rubrica
  técnica REV1 proposta, sem ratificação humana, candidato real ou tempo medido.

### Rulings e limites

PG318 usa somente service PostgreSQL descartável do CI, explicitamente CI=true e
IA318_PG_DESCARTAVEL=true, endpoints locais fixos. Não usa DATABASE_URL operacional.
Prova local Timescale inviável por espaço; não declarar PG PASS antes do CI.
Triggers cobrem escritores SQL/ORM, contador protegido contra downgrade. Escopo
profissional continua aplicação; RLS prova tenant, não carteira por si só.

Serialização reutiliza o lock do tenant317 já adotado pelos escritores canônicos,
sem ler/modificar flags ou conteúdo de gamificação. Operações administrativas
reutilizam executor de escopo verificado existente; nenhuma liberação317 alterada.
Fontes selecionadas obtêm FOR SHARE; inferência externa nunca mantém lock aberto.

Próximos checkpoints: Playwright desktop/mobile, builds/typechecks/lint/authz,
revisão R4 de contexto novo, push/PR única Draft e CI/PG do HEAD final. G01/G02
continuamBLOCKED; não confundir testes determinísticos com qualidade clínica.

## Fechamento do candidato técnico

Web: lint65warnings/0erros (superfícies318 sem warning), authz completo PASS,
build PASS, Playwright/axe desktop/mobile8PASS após acrescentar troca de sessão.
O primeiro smoke falhou por fixtures incompletas; corrigidos mocks, sem mudar
módulos anteriores. Nova rota operacional passou a usar o slug existente `[id]`;
o conflito `[tenantId]` foi corrigido após o Next reproduzir a falha de startup.
Backend completo2781PASS/91SKIPPED antes dos últimos endurecimentos; repetição
final/CI obrigatória. Typechecks backend/web e artefato backend PASS no candidato.

RED adicional: limite de texto/separadores1FAIL; rollback/RLS1FAIL; epoch do
ciclo de vida da clínica1FAIL; sessão na tela1FAIL; cadastro em sessão diferente
1FAIL; leitura ilimitada do stream1FAIL. Correções e testes focados GREEN.
Configuração/contexto/serviço21PASS; corpo/BFF4PASS. Campo contextoSessao é uma
correlação pública derivada da sessão verificada, sem poder de autenticação.
Backend permanece a fronteira; cadastro/revogação verificam a correlação.
Chave cifrada ligada também ao usuário, além de tenant/profissional/versão.

Migration1071 cobre quatro escritores (inclui tenants e ciclo de vida). Down
exige transação e role que possa auditar todos os tenants, locks exclusivos e
contagem zero; não confiar em contagem filtrada por FORCE RLS. Dez testesPG318
preparados para o service descartável do CI, ainda sem PASS nesta evidência local.
O esquema1070 integrado permanece intacto. Nenhum banco externo consultado.

Formatter efêmero Prettier3.6.2/MIT, integridade NPM SHA512
I7AIg5boAr5R0FFtJ6rCfD+LFsWHp81dolrFD8S79U9tb8Az2nGrJncnMSnys+bpQJfRUzqs9hnA81OAA3hCuQ==.
Ferramenta em/tmp, sem dependência de produto ou alteração de lockfile.

## Correções R4 — candidato posterior a0846811e

Revisão técnica por agente em contexto novo encontrou dois P2: geração/fontes
sem vínculo com a sessão original da tela e configuração de clínica sem esse
vínculo. Não é revisão clínica nem revisão humana independente. Três testes
RED reproduziram aceitação indevida; após correção, serviço/contexto24PASS.
Agora DTO, BFF, UI e comparação transacional exigem contextoSessao antes de
fontes/nonce/provider/CAS. Fontes passaram a POST; marcador nunca vai em URL.
Teste PostgreSQL adicional verifica zero nonce/provider e configuração intacta;
onze testes PG preparados, ainda pendentes do CI descartável.

Backend completo local2787PASS/96SKIPPED antes do último teste HTTP adicional;
HTTP5PASS/PG11SKIPPED. BFF4PASS antes do novo teste de encaminhamento.
Playwright8PASS desktop/mobile; espera do mock de credencial corrigida com
expect.poll (limpeza do input acontece antes de concluir a requisição).
Typecheck backend PASS; web detectou types Next antigos da rota renomeada:
a regeneração pelo build final é necessária, sem alteração do contrato [id].
Migration1071 ganhou @aplicacao fora-de-banda conforme gate do repositório.
Governança local passou confiabilidade/redação/migrations/guardas/actions;
preflight PowerShell BLOCKED por ausência de pwsh no ambiente, sem afrouxar teste.
CI precisa confirmar esse gate. Secrets/diff-check PASS após as correções.
G01/G02/G05 continuam BLOCKED; G03/G04 aguardam revisão corrigida e CI.

## CI408 — primeira execução e correção focal

PR única Draft: https://github.com/octanutri-clin/octaclin/pull/408.
HEAD48d9e8ba/run38431988071: governança/mobile/AI/CodeQL/Semgrep/Trivy e imagens
PASS. Backend2842PASS/41SKIPPED/2FAIL: inventário RLS e tenant vazio; os onze testes
PG318 PASS. A policy1071 faltava NULLIF para app.tenant_id vazio. Corrigida na
migration nova ainda não integrada/aplicada externamente, preservando1070.
Teste estático RED1FAIL/3PASS, GREEN4PASS; adicionada provaPG de leitura vazia
nas três tabelas318 (doze testes). Não afrouxados os testes gerais de RLS.
Web FAIL pelo any do novo teste318; substituído por Record<string,unknown>.
BFF final5PASS, lint local65warnings/0erros, builds/typechecks web/backend PASS.
PR Gate apenas agregou falhas backend/web; smoke não executado nessa rodada.
Rechecagem estática das duas correções de sessão no48d9e8ba: sem P1/P2 residual
concreto, limitada aos dois achados; não ratificação clínica/humana.
Inventário Code Scanning via REST BLOCKED403 (integração sem permissão); execução
CodeQL PASS não significa ausência comprovada de alertas no repositório.
CI do próximo HEAD obrigatório antes de concluir G03/G04.
