# FOOD02 — checkpoint backend

Base95e9f33d, branch `feat/pos320-food02-planejamento`. Desenvolvimento
T01–T05 autorizado em “Pode seguir, sol médio”. Dados exclusivamente sintéticos;
nenhum ambiente externo, fonte nova, dependência ou Web runtime alterados.

## Implementação

Biblioteca pessoal/clínica em tabela própria cifrada, com proprietário composto
por tenant, FORCE RLS, revisão/CAS e criação idempotente. Nome pesquisável por
índice HMAC existente, prefixos de palavras de3–32 caracteres; consulta em body.
Catálogos/fontes públicos permanecem separados, sem DML novo nesses registros.

Valores originais e base preservados; normalização decimal em escala8 sem
arredondar razão intermediária. Ausência difere de zero. Composição incompleta
pode ser cadastrada e salva editorialmente; não é publicável até completar
energia/macros essenciais. Não se infere energia, densidade ou micronutrientes.

Intenção `{id,revisao,aplicacaoId}` resolvida no backend; mapa privado cifrado por
chave editorial preserva composição já aplicada após edição/desativação da
biblioteca. Nova intenção/linha exige acesso atual. Null explícito desliga o
vínculo; omissão legada só preserva fatos iguais. Escritor clínico antigo recebe
409 quando descartaria contexto. Itens e alternativas usam o mesmo caminho.

FOOD01 agora distingue pai público/custom, com FK composta e XOR da1076, sem
editar1075. Pai pessoal não admite medida da clínica. A composição custom é
resolvida antes da medida. Publicação/cópias/nova versão preservam fatos, sem
transferir capacidade privada de biblioteca. Projeção custom usa allowlists
aninhadas; projeção/hash legados não foram redefinidos.

## RED/GREEN e falhas reais

- Normalização:27 RED com implementação ausente, depois GREEN com casos de
  base30g, precisão, ausência/zero, composição inválida e overflow.
- DTO:2 RED/15 PASS no esqueleto; depois GREEN. Overflow estruturalmente válido
  chega ao serviço para422, com RED/GREEN específico.
- Migration:2 RED de SQL/registro, depois GREEN; prova real veio no PG abaixo.
- Serviço:11 RED, depois GREEN; chave com formato inválido recebeu outro
  RED/GREEN. API/guardas:7 RED; rotas de medidas custom:5 RED, depois GREEN.
- Contexto editorial:5 RED, depois GREEN. Integração de plano:4 RED reais
  contra baseline antes da integração; a primeira tentativa parou por import
  ausente de `ServiceUnavailableException` no teste. O baseline foi restaurado
  para observar o RED comportamental; não se contabiliza erro de compilação
  como reprodução do contrato.
- Medidas:4 RED, depois GREEN, incluindo namespace de pai e proibição de
  compartilhamento de medida de alimento pessoal.
- Projeção:1 RED com campos privados simulados aninhados, depois GREEN; teste
  adicional conserva ordem/valores do snapshot legado.
- Primeiro PG:6 falhas de preparação (entidade nova faltava na lista particular
  da conexão de prova),28 PASS e29 filtrados. Corrigida a fixture; segundo PG:
  **34 PASS/29 filtrados**. Não apresentar a falha de fixture como vulnerabilidade
  ou RED clínico. Uma tentativa de editar a fixture usou cwd incorreto; foi
  corrigida antes da leitura da fixture na segunda execução.

## Gates

| Gate | Estado | Evidência |
| --- | --- | --- |
| Focados backend/migration | PASS final | 35 suítes/494 testes, `/tmp/food02-backend-focados-final.log` |
| Integral backend | PASS final | 350 suítes/3174 testes;6 suítes/133 testes SKIPPED condicionais, `/tmp/food02-backend-integral-final.log` |
| PostgreSQL15 descartável | PASS | 34 testes,29 filtrados; `/tmp/food02-postgres-green.log` |
| Timescale/pgvector/hypertable | SKIPPED local | Harness declara omissões; não substitui o CI com extensões |
| Typecheck | PASS | `pnpm typecheck`, `/tmp/food02-typecheck.log` |
| Build/artefato | PASS | `pnpm build`, `dist/main.js` validado; `/tmp/food02-build.log` |
| Frontend/BFF/Playwright/CI FOOD02 | SKIPPED checkpoint | T06–T08 posteriores, aguardando troca manual |
| Secrets/diff/matriz | PASS | Scanner sem achados, diff limpo e40 referências críticas válidas |
| Revisão independente | SKIPPED checkpoint | Não realizada; revisão própria não equivale a independente |
| Migration/deploy externos | SKIPPED | Não autorizados nem executados |

A suíte integral emitiu logs de erros simulados e avisos das fixtures existentes;
o resultado acima é o resultado do Jest, não a alegação de terminal sem avisos.
Logs `/tmp` são auxiliares transitórios; comandos e resumos ficam versionados.
Duas provas adicionais (substituição custom e composição parcial) passaram;
a suíte integral foi repetida depois, com3174 PASS. Checkpoints anteriores
(492 focados/3172 integrais) ficam preservados no ledger.

## O que o PG comprovou

Schema migrado numa instância descartável; role `pa05_runtime`, configurada
sem ownership/superuser/BYPASSRLS. Consulta sem tenant/cross-tenant não revela a
biblioteca e UPDATE de tenant errado é negado. Serviço nega outro proprietário,
mostra biblioteca da clínica sem permissão de editar e revalida vínculo arquivado.
FK composta impede pai de outra clínica e CHECK XOR impede zero/dois pais.

Criação concorrente retorna a mesma identidade; CAS permite um único vencedor.
Na disputa aplicação→desativação, o snapshot permanece; na disputa inversa,
solicitação bloqueada falha sem avançar revisão. Transferência impede acesso do
profissional antigo, preserva fatos para o novo responsável e nega nova intenção
sobre biblioteca privada. Publicação/projeção paciente não leva IDs privados;
nova versão preserva valores sem mapa reaplicável. Medidas custom e biblioteca
são testadas juntas. Não se deduz estado externo a partir dessa prova.

## Reprodução

Node22.21.1, lockfiles existentes, sem novas dependências. Na raiz:

```sh
node octaclin-backend/node_modules/jest/bin/jest.js --config octaclin-backend/package.json --runInBand --testPathPatterns='modulos/planos-alimentares|1076-AlimentosPersonalizados.spec.ts'
```

Em `octaclin-backend`:

```sh
node node_modules/jest/bin/jest.js --runInBand
node scripts/test-pa05-postgres-local.cjs --inventario
pnpm typecheck
pnpm build
```

O harness sobe a instância descartável explicitamente, sanitiza as variáveis do
filho e encerra o container. Não substituir suas conexões por credenciais reais.
Migration1076 e dependências só serão aplicadas externamente em operação
separada, conforme runbook, antes do backend novo. Rollback mantém leitor
compatível, tabela, referências e cifras; não apagar dados para regredir parser.
