# FOOD06 — integração factual PA06 (R4)

> Checkpoint histórico do incremento. O estado vigente consolidado da PR #455
> está em [consolidação](food06-consolidacao.md); evidências originais abaixo
> permanecem válidas somente para os commits e escopos indicados.

Branch própria `feat/food06-analise-factual`, base `1aba388a` da #456, dependente
explicitamente de #456 e #455. PR própria Draft. Não integra branches na main.

## Menor escopo

Expor composição/cobertura factual da seleção autorizada PA06, sem habilitar
RDA/AI/UL, diagnóstico ou persistência de análises. As comparações científicas
retornam indisponibilidade explícita `referencias_nao_habilitadas` no backend.
Não aceitar coeficientes, snapshots, tenant, contexto clínico ou elegibilidade
arbitrários no payload; usar o mesmo DTO mínimo/revisões da seleção PA06.

Reutilizar papel/permissão, carteira, paciente e plano, ExecutorTenant e a mesma
ordem de locks/revalidação antes de decifrar. Extração mínima do caminho comum
PA06 em helper privado, sem transação aninhada ou nova leitura fora da transação.
O contrato antigo continua inalterado. Rota computacional POST sem gravação,
`private, no-store`. BFF segue mesmas sessões/projeções e limites de payload.

## Provas antes do aceite

TDD serviço/rota: projeção factual, zero/ausência, snapshot corrompido, seleção
vazia, OFF, limite/revisão stale, outros pacientes/tenants/carteiras, papel e
permissão revogados; nenhuma escrita nem resposta parcial de seleção negada.
Prova PostgreSQL descartável com role runtime/FORCE RLS: seleção válida,
isolamento, carteira transferida, toggle/publicação/transferência concorrentes,
snapshots cifrados inalterados. Reutilizar fixtures/barreiras reais PA06.
BFF: autenticação, CSRF, validação de payload e resposta por allowlist/no-store.
Revisão independente R4 do delta e regressões backend/Web afetadas; CI no HEAD.

Somente ambiente local descartável/CI com dados sintéticos. Sem staging/produção,
DDL externo, merge/deploy ou mudanças de quota/infra. Sem migration nova.
Rollback de código sem perda ou conversão de histórico. M01–M12/Onda A não são
concluídas por este incremento; contexto/referências/UI/histórico seguem gates
próprios. Direitos e G06 permanecem BLOCKED; FOOD05-MDL fora do escopo.

## Execução — contrato e segurança

Implementado `POST /pacientes/:pacienteId/planos-alimentares/analise-micronutrientes`
e BFF correspondente. Body reutiliza `CalculoCombinadoDto`/64KiB: IDs autorizados,
versões publicadas e revisão de ativação. Nenhuma entrada de composição, dados
populacionais ou coeficientes aceita. Escopo desta rota é factual; não calcula
percentuais diários nem requer contexto clínico desnecessário para somar fatos.
O contexto puro anterior será conectado somente à comparação científica elegível.

A resposta continua PHI/dado clínico derivado, não anonimizado: não deve ser
registrada em logs, analytics, cache persistente ou documentação pública real.
Fixtures são exclusivamente sintéticas.

Resposta por projeção: schema/motor, instante, publicações/revisões, cálculo PA06,
cobertura com contagens/causas e comparação indisponível. Não repassa registros
ORM, ciphertext, descrições de itens ou contexto interno. Sem persistir resultados
ou alterar publicações. M01 permanece parcial: fontes por nutriente, UI e relatório
não são entregues aqui. M05/histórico/cenários também não são concluídos.

Matriz de acesso preservada da PA06, sem nova concessão:

| Identidade | Resultado esperado |
| --- | --- |
| Professional autorizado, paciente na carteira, `planos_alimentares.ler` | Fatos da seleção autorizada |
| Professional de outra carteira/tenant ou sem permissão | Negado, sem subtotal |
| Client/Patient/outros papéis | Negado pelo backend |
| SuperAdmin no escopo tenant e com permissão existente | Mesma leitura privilegiada já prevista na PA06, sem bypass de tenant |

O helper privado comum não inicia transação adicional. Validação/autorização da
seleção completa precede decifragem. O projeto PA06 continua resolvendo as
publicações, identidades, estados ON/OFF e locks na ordem preexistente.

## Testes realmente executados

| Verificação | Evidência |
| --- | --- |
| Serviço TDD | RED8 falhas/113 passes → GREEN121/121 |
| Registro da rota/leitura/no-store | RED1 falha/20 passes → GREEN21/21 |
| BFF TDD | RED3 falhas/70 passes → GREEN73/73 |
| Backend completo | PASS3.781, SKIPPED166;374 suítes aprovadas/nove skipped |
| Typecheck backend/Web | PASS, Node22.23.4 |
| Build Nest/verificação do artefato | PASS, não é deploy |
| ESLint arquivos Web alterados | PASS |
| Web build local | Compilação Web concluída; comando FAIL ao carregar runtime Next a partir dos artefatos temporários. Arquivo existe no cache. Aguardar build normal CI; não alterar config/deps para contornar |
| Cadeia local authz | PASS27/27 scripts executados diretamente, Node22; todas saídas exit0 |
| PostgreSQL/RLS CI do código80763589 | PASS: suíte completa com banco real e etapa Testcontainers adicional concluídas. Cinco casos novos incluídos sem filtro na suíte oficial |

Os166 skipped incluem os cinco casos novos e integrações opt-in. Não são prova
de banco. Testes sintéticos em memória validam comportamento do serviço, sem
substituir role runtime, RLS ou concorrência PostgreSQL.

Cenários novos no gate oficial `rls-isolamento-tenant.integracao.spec.ts`:

1. Snapshots cifrados, zero conhecido/ausência, resposta mínima, replay sem escrita
   e negação de leitura das versões em outro tenant.
2. Carteira/tenant alheios, seleção mista e papel/permissão revogados.
3. OFF concorrente e rejeição de revisão de ativação obsoleta.
4. Publicação concorrente, versão stale rejeitada e histórico preservado.
5. Transferência aguarda lock compartilhado; leitura consistente e revogação
   efetiva no pedido seguinte.

Fixtures/barreiras são as da PA06. O workflow oficial Backend já executa
`pnpm test:rls:testcontainers`; nenhum workflow ou migration precisa mudar.
Local: daemon Docker acessível, mas a imagem Timescale do harness integral não
está instalada e o overlay tem cerca de139MiB livres. Não iniciar download que
esgotaria a worktree. Imagem PostgreSQL15 disponível não substitui a dependência
Timescale nem comprova o inventário integral. Gate real deve executar no CI;
localmente continua NOT RUN. A evidência obtida no CI está registrada abaixo.

## Ambiente e limites

Mesmo Node22 verificado e ferramentas em cache dos incrementos anteriores;
ts-jest29.4.14 em cache versus29.4.15 do lock. Instalação exata continua limitada
pela política de dependências registrada em A1. Next em cache16.3.8.
`node_modules` é symlink ignorado; artefatos `.next` ficam em `/tmp` via symlink
ignorado, sem mudar configuração, lock ou arquitetura do produto.

`pnpm run test:authz` tentou instalar módulos e abortou por falta de TTY;
**não é teste funcional FAIL ou PASS**. Não desativar política, purge ou checagens.
Os comandos Node da cadeia `test:authz` são executados diretamente, com Node22,
sem invocar instalação. Erro inicial de diretório na preparação do teste BFF
foi corrigido antes do RED funcional; somente o arquivo criado nesta tarefa foi
movido e os diretórios vazios removidos. Não houve descarte de trabalho alheio.

Revisão independente R4 do delta por `/root/food06_factual_r4_final`, somente
leitura, sem coautoria/edição: nenhum defeito concreto bloqueante identificado.
Conferiu autorização, transação/locks/revisões, DTO/projeção e wrappers BFF/Origem.
Reexecutou142/142 testes backend e73/73 BFF. Não executou PostgreSQL/RLS, build
ou suíte completa; esses limites permanecem. Não é R4 integral de todas as ondas.
Revisão anterior parcial por outra instância também não trouxe achado concreto.
UX B/C e Playwright de UI: NOT RUN, nenhuma interface foi entregue neste incremento.
CI de `1aba388a`/#456 permanece evidência anterior, não valida o delta atual.
Mobile já falhava naquela consulta; não alterar lock ou suprimir auditoria aqui.

## Handoff e saída

- Branch: `feat/food06-analise-factual`, dependência explícita #456/`1aba388a`.
- Concluído: serviço, projeção, rota e BFF factuais, TDD e testes de segurança
  sintéticos; cinco provas reais preparadas no gate oficial.
- Comprovado: revisão independente delimitada e PostgreSQL/RLS no CI de código80763589.
- Comprovado: Web CI/build e authz, além dos27 scripts locais de autorização.
- Pendente: CI global/Demo smoke e demais ondas obrigatórias. Nenhum gate não
  executado PASS; auditoria Mobile segue FAIL e não é dispensada.
- Próxima ação: verificar os checks do HEAD documental final e o Demo smoke,
  mantendo a auditoria Mobile em fluxo separado. Não herdar aprovação global do
  código80763589 para outro commit. Corrigir novos achados reproduzíveis.
- Rollback: código aditivo e helper comum; sem schema, dado persistido ou recálculo
  retroativo. Sem merge/deploy/migrations externas/G06 ou FOOD05-MDL.


## Evidência CI do commit de código80763589

Run[41211610808](https://github.com/octanutri-clin/octaclin/actions/runs/41211610808),
job[Backend124567639420](https://github.com/octanutri-clin/octaclin/actions/runs/41211610808/job/124567639420).
Consulta da API GitHub: job `completed/success`. Etapas aprovadas:
instalação `--frozen-lockfile`, auditoria de licenças das dependências, typecheck,
build, migrations exclusivamente no banco descartável CI, role runtime de prova
sem BYPASSRLS/ownership, suíte completa, Redis real e Testcontainers/RLS.

O workflow versionado `ci.yml` configura a role de prova para a suíte completa;
o runner Testcontainers remove configurações externas e define
`RLS_TESTCONTAINERS=true`. Ambos incluem a suíte de isolamento, com os cinco
casos FOOD06 incondicionais dentro do describe habilitado. Prova por estado das
etapas/API e contratos do workflow; não inventar contagens por caso dos logs.
Não reutilizar os números locais como se fossem contagens extraídas do CI.
O download dos logs completos ficou indisponível no destino de redirecionamento
(HTTP403). Não copiar URLs temporárias assinadas nem contornar política de rede.

Essas etapas aprovadas validam o código80763589, não commits futuros. A auditoria
de licenças de dependências não libera direitos das tabelas DRI. Web foi posteriormente concluído com `success`, incluindo authz e build normal.
O build normal CI comprova a compilação no ambiente suportado; a falha local
continua registrada e não motivou mudança de config/dependências. Demo smoke
seguia em execução na consulta; Mobile FAIL e SBOM provenance SKIPPED. Sem
aprovação assistencial, merge, deploy ou disponibilidade em produção.


Conferência de ambiente: a worktree principal permanece com a alteração
preexistente em `octaclin-web/next-env.d.ts`, sem descarte ou inclusão neste delta.
As worktrees/dependências reutilizadas não receberam alteração versionada.

### Integração de interface seguinte — auditoria concreta

`CalculoCombinadoPlanos` já mantém a seleção PA06 em memória e invalida respostas
por chave (paciente/seleção/revisão/publicação), geração e AbortController. Reusar
esse contexto na futura tabela FOOD06, sem nova seleção paralela, storage ou
confirmação clínica presumida. Não modificar a resposta do endpoint PA06 legado.
Reusar `CAMPOS_MICRONUTRIENTES_PLANO`, formatação pt-BR e os cenários desktop/mobile
`pa06-calculo-combinado.spec.mjs` para testar zero, parcial, OFF e revalidação.
A análise factual adicional pode ser carregada sob demanda quando o detalhe for
aberto; respostas tardias devem seguir a mesma proteção por chave/geração. Nenhuma
interface implementada por este registro; UX B/C exigem interface real.


### Fechamento documental do incremento

Após código80763589, a consolidação muda somente documentação/checklists/status.
Backend/Web/banco real e revisão independente registrados acima continuam como
prova daquele código. Antes do push documental, Demo visual Playwright ainda
estava em execução (Smoke UI e Smoke E2E BFF já aprovados). A atualização normal
da branch pode cancelar o run anterior; cancelled não será interpretado como
PASS ou falha funcional. O novo HEAD deve executar seus próprios checks, sem
skip-ci, waiver ou bypass. CI global permanece aberto/FAIL por Mobile até a
correção separada e comprovação do HEAD final. Nenhuma prontidão de FOOD06 plena
ou autorização de merge decorre deste incremento.
