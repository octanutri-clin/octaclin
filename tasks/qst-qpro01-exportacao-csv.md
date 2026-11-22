# QPRO-01 — escopo explícito na exportação de respostas

## Decisão e contrato

Proprietário aprovou duas opções em 22/11/2026: **Exportar resultados filtrados**
e **Exportar todas as respostas**. Base `9b9747d4203e8b798af4ee69b81e8ffb42892803`
(merge #572), branch `feat/qst-exportacao-escopo`. Não inclui FOOD06 nem alterações
de runtime, dependências, migrations ou infraestrutura. Risco R4: exportação de
conteúdo clínico, com revisão independente e provas de isolamento específicas.

Filtrados significa **todos os campos dos envios exibidos**, não apenas o campo
que encontrou o termo. Paciente e busca atuais determinam a seleção já exibida;
o navegador envia somente IDs em POST, sem texto clínico na URL. IDs continuam
protegidos: não são capabilities, não concedem acesso e não vão para auditoria.

- `GET /questionarios/:id/respostas/exportar.csv`: contrato completo legado preservado.
- `POST` no mesmo caminho: `{ respostaIds: UUID[] }`, entre1 e1000, sem duplicatas/campos desconhecidos. Mais de1000 é bloqueado com orientação para refinar; nunca truncar ou dividir silenciosamente.
- A seleção é revalidada no tenant/questionário e na carteira ativa no servidor. ID indisponível ou acesso revogado falha a operação inteira, sem arquivo parcial. A autorização da modalidade completa mantém o contrato legado; não apresentar a nova checagem de carteira como correção retroativa de todo o leitor antigo.
- O backend reutiliza `montarCsv` e a resolução de perguntas/snapshots existente. Não altera respostas, definições, versões ou snapshots. Nenhuma reinterpretação nutricional ou clínica.
- Campos de ausência, zero e booleanos mantêm o formato legado; proteção de fórmulas CSV não foi substituída.

## Implementação mínima

Backend: `servico-questionarios.ts`, DTO e controller de questionários.

1. Validar tamanho/tipos/UUIDs e normalizar identidades.
2. Autorizar questionário e buscar somente IDs dos envios; projetar metadados mínimos dos checkins selecionados.
3. Rejeitar qualquer ID que não corresponda integralmente à seleção autorizável.
4. Autorizar pacientes em lote, com tenant, carteira ativa e ordem estável de `FOR SHARE`, dentro do `ExecutorTenant`.
5. Só após autorização, buscar `id`, `questionarioId` e `snapshotEstrutura` dos envios selecionados. Nunca carregar rascunhos nessa modalidade.
6. Resolver valores e gerar o CSV pelo formatador canônico.
7. Auditar somente escopo/volume, usando `contarLinhasCsv` para contar registros com células multilinha corretamente.

BFF: POST no arquivo da rota existente; wrappers de sessão/permissão e origem,
UUIDs/allowlist, request limitado a64KiB e resposta a16MiB. Erro genérico, headers
fixos, `private, no-store`, `Vary: Cookie` e `nosniff`; não propagar body de erro
do backend. Limite de saída excedido falha com orientação para refinar, sem corte.

Web: `ExportacaoRespostas` integrado à área existente. Preview da lista não
baixa arquivo. Sem resultado/carregando/preparando/seleção excessiva desabilita a
ação filtrada. Ref evita duplo disparo. Identidade do componente acompanha
questionário, paciente, busca e IDs; mudança de contexto descarta download e erro
antigos. Blob URL temporária revogada após uso, sem arquivo público ou storage
clínico novo. A modalidade completa explicita que ignora filtros da tela.

## TDD e evidências

Checkpoint documental antes do push; resultados posteriores são registrados na descrição da PR e nos checks do HEAD, sem atribuir PASS antecipado.

| Prova | Resultado observado |
| --- | --- |
| Serviço, RED inicial | 7 falhas funcionais /1 caracterização aprovada: exportador ignorava IDs, devolvia conjunto completo e aceitava seleção inválida |
| Setup de teste | Erro inicial de tipo em `test.each` corrigido antes do RED; não conta como falha funcional |
| Serviço GREEN + regressão | 52 PASS inicialmente; 53 PASS após correção final de minimização |
| HTTP RED | 5 falhas por ausência do POST;19 casos P05 existentes PASS |
| HTTP GREEN | 24 PASS, com guards/pipes reais; serviço/identidade simulados, não prova de banco |
| Backend ampliado | 121 PASS em10 suítes antes do ajuste final; as53 verificações diretamente afetadas foram reexecutadas após o ajuste |
| BFF específico | 13 PASS; inclui negativas sessão/permissão/origem/payload, forwarding só de IDs, CSV e erro interno não propagado |
| PostgreSQL/RLS final | 4 PASS, runtime NOSUPERUSER/NOBYPASSRLS, FORCE RLS, seleção, outro tenant, adulteração, transferência e concorrência controlada |
| Prova RLS adicional | Consulta direta sem predicado de tenant retorna vazio no tenant errado; reexecução dirigida1 PASS,3 casos não selecionados pelo filtro de teste |
| Browser RED | Botão filtrado ausente, falha funcional no Next real |
| Regressão browser | 66 PASS desktop/mobile, incluindo regressões #570/#572 |
| CSV e acessibilidade final | 8 PASS dirigidos;68 cenários únicos no conjunto das execuções, sem somar repetições. Teclado, fonte200%, axe no grupo, erro de acesso, vazio, busca/paciente e descarte de download tardio |
| Typechecks/lint | Backend/Web Node22.21.1 e lint Web dirigido PASS nas execuções registradas; build final Next webpack/TypeScript integrado PASS. Rechecagem geral final do backend também PASS |
| Agregado authz | Launcher pnpm11.19/Node24 tentou reconciliar módulos e abortou sem reinstalação. Os28 scripts canônicos foram executados diretamente com Node22, sem mudar sua implementação:28 PASS,0 falhas |

Schema de PostgreSQL é **sintético explícito**, não ensaio de migrations. Container
novo descartável; nenhuma conexão staging/produção. A primeira execução tinha um
nome de tabela errado na fixture; corrigido, sem classificar erro de setup como RED.
No teste concorrente, a transação administrativa segura o registro, a prova exige
runtime esperando `Lock` em `pg_stat_activity`, então confirma transferência e
negação. Não confundir ausência casual de deadlock com essa evidência controlada.

## Revisão e riscos

R4 independente estática `/root/qst_csv_r4`, sem autoria ou execução própria de
testes. A primeira revisão não identificou bloqueador, mas a conferência adicional
encontrou P2 de minimização: o leitor carregava snapshots e rascunhos antes da
autorização. O novo teste reprovou pela ausência de projeção mínima; corrigido com
leitura só de IDs antes e snapshots selecionados depois. Revisor confirmou P2
corrigido e nenhum novo achado nessa diferença. Não houve evidência de devolução
dos rascunhos ao cliente. GET legado não foi refatorado por conveniência.

UX profissional A/D reaproveitado do NUX-01, aprovado pelo dono; B/C favorável ao
escopo relatado, sem teste próprio da persona. Paciente N/A: console/exportação
profissional, sem portal, envio automático ou alteração do conteúdo clínico.
[Parecer e capturas sintéticas](../docs/agents/ux/reports/QPRO-01-BC-2026-11-22/consolidado.md).

Limites: navegador usa BFF/cookies sintéticos; não prova login real ou todo o
isolamento. Leitor de tela manual, aparelho físico e produção NOT RUN. Módulos
locais reutilizados diferem do manifesto atual (Next16.3.8 versus ^16.4.5); CI com
instalação congelada é obrigatório. Sem alterar engines/lockfile. Metadata inicial
de envios ainda percorre o questionário; paginação/busca global server-side é
QPRO-03 separada. Não prometer reexportação de uma análise histórica imutável:
o arquivo reflete os registros autorizados no momento da solicitação.

Código validado por camadas: backend `722036ad028e3751ab794b574f719f74d7f40382`; conjunto backend+Web `96a49b735306fc1047f1b1d1e0fb0c0bddca56e9`.

## Correção do gate de auditoria

O CI do HEAD documental `474f8b2c` falhou em `test:redacao-auditoria`: a nova chave `escopo` não estava coberta pela política. RED local:23 PASS/1 FAIL. Corrigido usando `{ tipo: 'csv_filtrado', linhas }`, chave operacional já permitida e valor literal. Nenhuma alteração no redator, allowlist, severidade ou workflow. Gate24/24 e HTTP24/24 PASS após correção; R4 estática pontual confirmou ausência de nova exposição. O novo HEAD deve ser validado pelo CI; a falha do anterior é histórica, não um resultado verde.

Aprendizado: ao criar metadados de auditoria, conferir o vocabulário e executar o gate de redação antes do push, além do teste HTTP.

## Handoff e gates

Não declarar Ready for Review enquanto CI do HEAD exato, scanners e comentários
estiverem pendentes. Publicar uma vez após validações locais, em PR Draft própria.
Sem merge/deploy/migrations externas. O CI pós-merge #572 na main é evidência
separada, não valida este incremento; disponibilidade produtiva não consultada.
O retorno consiste em reverter o código do incremento: não há dado novo persistido
para desfazer; arquivos já baixados não são revogados por rollback de código.

Próxima melhoria sugerida após aceite: QPRO-07, recuperação do histórico, em
escopo próprio; não iniciar automaticamente.
