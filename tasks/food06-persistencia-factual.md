# FOOD06 M05/M07 — persistência factual cifrada

## Estado vigente e limites

PR #455 Draft, branch `docs/food06-contratos-fontes`. Base local `5ecb21b0`,
remota `5ac34b60`, mesma árvore `f678af73`; históricos preservados. Incremento
R4 de armazenamento interno, sem API/BFF/UI, fonte clínica real integrada ou
ativação. M05/M07 continuam PARCIAIS. **37,5% administrativos**, 1 concluída,
7 parciais e 4 pendentes. Direitos/DRI/G06 BLOCKED. FOOD05-MDL/D18 não iniciada.

O construtor anterior permanece disponível e inalterado. Este incremento acrescenta
registro durável cifrado e índice paginado de metadados, não uma análise clínica
completa acessível no produto. Não representa conclusão de M05/M07 ou FOOD06.

## Arquitetura e contrato interno

`ServicoRegistrosAnaliseFactual.registrar` reutiliza o construtor factual,
`ExecutorTenant`, `CriptografiaDadosSensiveis` e auditoria transacional existentes.
Só Professional responsável atual, com permissões ler e gerenciar, pode registrar;
índice exige ler. Tenant/usuário são contexto autenticado interno, nunca seleção
livre do navegador. Client/SuperAdmin/Collaborator/Patient não recebem exceção.

Ordem local de locks: profissional ativo FOR SHARE → paciente ativo da carteira
FOR SHARE → advisory transacional determinístico por tenant/usuário/chave.
Sem transações aninhadas, retries cegos ou persistência parcial. Arquivamento
concorrente do profissional é serializado e revalidado pelo PostgreSQL.

O callback recebe o MESMO EntityManager. **Ainda falta implementar o carregador
real dos planos/versões e sua autorização, revisão exata/CAS e ordem de locks
integrada aos demais serviços.** O serviço confere escopo/identidade/revisão
retornados pelo callback, não comprova que uma fonte arbitrária seja legítima.
Não expor esse callback, snapshots, totais ou hashes como body HTTP.

Comando por allowlist: UUID de idempotência, plano/versão, número, estado e revisão
positiva obrigatória apenas para rascunho. Não aceita campos desconhecidos ou
origem por “última versão”. A data registrada/contexto precisam ser estáveis no
carregador futuro para reproduzir a mesma intenção em retries; não usar now em
cada tentativa como identidade de uma análise já confirmada.

## Persistência e segurança

Migration aditiva **1081**, apenas criada/testada em descartável. Número verificado
contra a árvore main `ec1a16b21820552c2958d4712b68f8074135b54f` e branch, cuja
última migration era1080. A 1079 da FOOD05 permanece independente. Nenhuma
migration externa aplicada, alteração de ledger produtivo ou inferência de schema.

Nova tabela justificada: snapshots de PlanoAlimentarVersao pertencem à revisão
editorial/publicação; DocumentoEmitido pertence à emissão/entrega ao paciente.
Nenhum deles comporta várias análises factuais deliberadas sem alterar seus
contratos. Não criar sistema paralelo de composição; a tabela só armazena o
resultado do motor existente e seus dados reprodutíveis.

- FKs compostas tenant/paciente, profissional e usuário; deleções RESTRICT.
- FORCE RLS, apenas policies SELECT/INSERT. UPDATE/DELETE não têm policy.
- Runtime comprovada não owner, sem SUPERUSER/BYPASSRLS. TRUNCATE é negado por
  **ausência de privilégio**, não por RLS. Gate operacional futuro deve conferir
  grants reais, incluindo ausência de TRUNCATE e de capacidade de alterar policies.
  Owner continua privilegiado; não alegar imutabilidade contra administrador.
- Corpo clínico, contexto e marcadores cifrados pelo serviço existente. Envelope
  versionado vinculado a id/tenant/paciente/profissional/usuário/chave da linha;
  troca de ciphertext entre registros não produz ACK válido. Nenhum hash clínico
  claro adicional, nem nomes, corpo clínico ou fingerprint na auditoria.
- Limite técnico do registro10MiB; recusa integral antes de gravar. Esse limite
  não altera consultas factuais já existentes nem converte ausências em zero.
- Unique tenant/usuário/chave e advisory: mesmo conteúdo confirmado reutiliza id;
  conteúdo/paciente diferente produz conflito, sem sobrescrever. Cipher inválido
  ou binding incompatível falha com mensagem genérica, sem divulgar seu conteúdo.
- Registro e auditoria mínima na MESMA transação. Falha de auditoria desfaz tudo;
  a chave pode ser repetida após rollback. Não usar outbox que permita falso ACK.
- Respostas por allowlist `{id, criadoEm}`; índice com paginação validada1..10000,
  limite1..100 e ordem data/id. Não decifra corpo e não é leitor clínico completo.
  Paginação por offset não promete snapshot estável entre requisições concorrentes;
  API futura exige contrato próprio de cobertura/cursor quando necessário.

## Rollback e compatibilidade

Migration só adiciona tabela, sem alterar snapshots, receitas ou versões de planos.
Nenhum writer/endpoint antigo é redirecionado. Reverter código não apaga análises;
`down` recusa destruição do histórico. Restauração, retenção/descarte legal,
compatibilidade de leitores e rotação de chaves exigem procedimento próprio antes
de implantação. Não afirmar que Object.freeze protege banco ou que reverter deploy
restaura compatibilidade. Synchronize e migration automática permanecem desligados
pelos controles existentes; sem alteração de dependências/engines/infraestrutura.

## Evidências desta rodada — 03/11/2026

Node22.23.4 oficial. Somente dados sintéticos em PostgreSQL15-alpine descartável,
banco `food06_registry_test`, owner sintético para schema e runtime `food06_runtime`
sem bypass/ownership para operações. Não acessa Neon, staging ou produção.

| Verificação | Resultado e limite |
| --- | --- |
| TDD schema | RED funcional1FAIL/2PASS antes do SQL; GREEN3/3 |
| TDD writer | RED funcional “Registro não implementado” em PG inicializado; GREEN posterior |
| Concorrência de revogação | RED funcional sem espera de lock; GREEN observa Lock real, arquivamento e404/zero registros |
| Schema + PostgreSQL | PASS16/16:3schema+13PG, zero skipped, após correção |
| Idempotência concorrente | Quatro chamadas mesma chave/conteúdo → uma linha/uma auditoria; UUID case normalizado |
| Autorização e integridade | Roles/permissões/carteira/transferência/arquivamento/tenant; FK cross-clinic; payload malformado; revisão retornada divergente |
| Cifragem/rollback | Persistência real cifrada, binding, projeção mínima, UPDATE/DELETE sem efeito, TRUNCATE sem grant, falha de auditoria sem gravação |
| R4 independente | food06_persistence_r4: revisão de leitura,15testes próprios iniciais; observação de lock corrigida com TDD e reexecução própria16/16; sem bloqueadores no escopo interno |
| Typecheck/build | PASS Node22, Nest e artefato dist/main.js |
| Governança | PASS37 testes de auditoria/migrations fora de banda |
| Backend completo final | PASS4.005 testes/383suítes;193testes/10suítes SKIPPED pelos gates explícitos, não aprovados implicitamente |
| Regressões PG FOOD04/1080/1081 | PASS36/36 em3suítes PostgreSQL reais, zero skipped; primeira chamada sem flag RLS deixou19SKIPPED, reexecutada corretamente |
| Cadeia completa de migrations/role operacional | NOT RUN local: imagem Timescale oficial não está em cache; CI oficial mantém esse gate, sem baixar imagem volumosa para disco limitado |
| CI/scanners do delta | PENDING até publicação/consulta do HEAD exato; sucesso de base não valida este delta |
| Web/UX B/C/Playwright novos | N/A neste incremento sem interface/HTTP; continuam necessários quando existir jornada utilizável |

Testes e comandos reproduzíveis (cwd backend; usar Node22 no PATH):

```sh
FOOD06_REGISTRO_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.spec.ts
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
```

O wrapper oficial `scripts/test-rls-testcontainers.mjs` do backend agora inclui a
1081 e seu flag junto das provas existentes; continua removendo configurações de
banco externo. Localmente foram removidos somente overrides DOCKER_HOST/CONTEXT/TLS
na chamada para usar o daemon local com imagens em cache. Sem mudar configurações.
Logs sintéticos locais em `/tmp/food06-persist-{schema-red,writer-red,lock-red,green4,full-final,typecheck-final,build,governanca,pg-regressoes}.log`.
Não confundir problema de fixture (constraint inicial validando linhas antigas,
clone de outro realm) com RED funcional. Ambos foram corrigidos no teste sem
relaxar validação de produção.

Disco ficou cheio; preservado somente o dist gerado/ignorado deste pacote em
`/tmp/food06-dist-anterior-persistencia` e reconstruído. Delta e dependências
preservados. Alteração preexistente main `octaclin-web/next-env.d.ts` não tocada.

## CI da base e publicação

Consulta da base remota5ac34b60: DependencyReview, coleta documental, CodeQL,
Semgrep e Trivy SUCCESS. Run41665963149 ainda IN_PROGRESS na consulta, com
Backend/PostgreSQL/RLS, Web, Mobile, AI e governança SUCCESS, Demo visual ainda
em execução. **Não declarar verde global da base nem transferir os resultados
para o delta novo.** Novo commit tem gates próprios. Publicação preservará a
identidade da árvore local/remota e histórico, sem reset/rebase/force-push.

## Próxima ação e gates restantes

1. Conferir CI do HEAD publicado, incluindo migrations completas e PG/RLS oficial.
2. Carregador autorizado server-side de versões imutáveis/revisões de rascunho,
   fontes/proveniência e contexto canônico por clínica. Fixar ordem de locks com
   os escritores existentes, testar CAS/stale, transferência, revogação e rollback.
3. Leitor clínico com decodificação/validação integral do envelope, binding e
   projeções mínimas. Índice de metadados não substitui esse contrato.
4. API/BFF de registro/leitura/comparação e controles de payload/idempotência;
   depois UI e UX B/C, desktop/mobile/teclado/tabela e testes de jornada.
5. Referências comuns e direitos permanecem gates separados. Não habilitar DRI,
   recalcular históricos, implementar FOOD05-MDL ou executar operação externa.

## Retomada — falha do inventário global RLS

HEAD remoto a56cf204: CI41671191108 FAIL no Backend job126040315172,
suíte rls-isolamento-tenant, inventário de policies. 4.119PASS/1FAIL/78SKIPPED
nesse job. Migrations completas passaram antes da falha. Demo, Web, Mobile, AI,
governança e scanners SUCCESS; PR Gate FAIL por dependência do Backend.
Não classificar CI global como aprovado.

Causa comprovada: o inventário só reconhecia plano_alimentar_ativacao_eventos
como append-only. A1081 tem exatamente SELECT USING tenant e INSERT WITH CHECK
tenant, sem UPDATE/DELETE. Exigir ALL seria ampliar privilégios indevidamente.
Correção mínima: incluir nominalmente registros_analises_factuais na mesma
verificação restrita existente, mantendo exigência de exatamente duas policies
e expressões de tenant para ambas. Nenhuma policy/grant/migration foi relaxada.
RED é a falha funcional do CI citada; GREEN integral depende do novo CI com banco
completamente migrado. Testes específicos schema/PG16/16 PASS em Node22.23.4 nesta retomada.
R4 independente food06_persistence_r4 favorável ao patch estático: ALL,
UPDATE/DELETE, policy extra/ausente continuam falhando por construção.
Revisor não executou inventário global; o predicado lexical de tenant existente
não equivale a prova semântica de qualquer SQL arbitrário.
