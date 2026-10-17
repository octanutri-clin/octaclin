# FOOD01 — checkpoint backend (2026-10-17)

## Escopo e autorização

Branch `feat/pos320-food01-planejamento`, base `d36b12e7` (#423/PA07).
Planejamento em `e0cb3fbb`; desenvolvimento autorizado em “Pode seguir”.
Sol6.1 médio implementou T02–T05; T06/interface depende de troca manual para
Luna alto. Uma PR única futura; nenhuma PR somente para o checkpoint.
Risco R4: autorização, dados cifrados, migration e integridade de planos.

## Entrega

- Biblioteca pessoal/clínica, pessoal por padrão; só criador altera/desativa.
  GET/POST/PATCH autorizados, vínculo ativo conferido na transação e DTO mínimo.
- Conteúdo e pedido original cifrados; criação idempotente serializada por
  chave tenant/profissional, replay divergente409; PATCH com CAS/lock.
- Conversão decimal exata em milésimos, BigInt e half-up final; limites antes
  do arredondamento. Sem inferência de densidade nem importação de dados externos.
- Documento editorial carrega somente intenção ID/revisão/nonce. Contexto
  confiável separado, cifrado/schema1 na versão. Salvar de novo preserva a
  referência aplicada; reaplicar exige autorização atual. Null desvincula;
  omissão legada preserva somente fatos idênticos. Exclusão de item limpa contexto.
- Rascunho autorizado projeta apenas base da medida por chave do item para a
  reabertura da UI; nenhuma consulta viva à biblioteca nem projeção de proprietário.
  Publicações/portal/PDF usam as projeções existentes sem esse mapa.
- Migration1075 aditiva registrada no TypeORM; FORCE RLS e FK tenant/profissional.
  Migrations anteriores intocadas. Novo cipher não gera recálculo retroativo.

## RED/GREEN observados

| Ciclo | RED reproduzido | GREEN |
| --- | --- | --- |
| Conversão | 21 casos falharam pela ausência da função, após corrigir a asserção de existência para não tornar negativos falsamente verdes | 21 casos PASS; referência obrigatória e limites explícitos |
| Biblioteca | 7 casos falharam pela classe ausente (import válido com contrato vazio) | Criação/cifra/projeção, replay, CAS, acesso e fonte PASS |
| Migration | 1 caso falhou pela classe ausente | SQL/invariantes/RLS/rollback PASS; prova de banco separada abaixo |
| DTO HTTP | 12 casos falharam pelo contrato ausente | 12 PASS, incluindo null/extra/campo de proprietário e revisão inválida |
| Editorial | Referência nova recusada pelo parser existente | Intenção mínima aceita, referência adulterada recusada |
| Preservação | 6 novos casos falharam pela função ausente | Mesma referência não consulta biblioteca; novo alimento/chave/nonce revalida; parcial/replay PASS |
| Save | 2 casos falharam: peso do cliente permaneceu e erro esperado de autorização não ocorreu | Peso autoritativo e cipher preservados; acesso recusado não vira sucesso parcial |
| HTTP | 5 casos falharam pelo controlador ausente | Papéis/guardas/permissões/no-store/encaminhamento PASS |
| Desvinculação | 2 casos falharam: null recusado e vínculo restaurado | Null explícito preserva fatos sem restaurar seleção |
| Schema do cipher | 2 casos falharam: sem schema1 e versão desconhecida aceita | Cipher inválido/schema desconhecido bloqueiam sem salvar |
| Projeção para reabrir | 1 caso falhou: base histórica ausente | Projeção mínima autoritativa no rascunho PASS |

Uma primeira invocação usou caminho incorreto e não encontrou testes; não foi
tratada como RED. Em uma etapa intermediária, um teste exigiu rejeitar undefined
no argumento que tinha default; corrigidos contrato/helper para referência
obrigatória antes de obter GREEN. A rodada integral inicial pegou os dois casos
RED de schema durante o desenvolvimento; resultado anterior não é o gate final.

## Comandos reproduzíveis e evidências

Toolchain Node22.21.1 baixada do fornecedor oficial; SHA256 comparado com
SHASUMS256.txt antes de extrair. Sem modificar engines ou lockfiles.
Executável nesta sessão: `/workspace/.toolchains/food01/node-v22.21.1-linux-x64/bin/node`.
Dependências backend reutilizadas por symlink da PA06, após cmp dos lockfiles.
Com Node22 no PATH, a partir de `octaclin-backend`:

```sh
node node_modules/jest/bin/jest.js --runInBand --testPathPatterns='modulos/planos-alimentares|1075-MedidasCaseiras.spec.ts'
node node_modules/jest/bin/jest.js --runInBand
node scripts/test-pa05-postgres-local.cjs --inventario
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
```

Na raiz:

```sh
node --test scripts/validar-guardas-controladores.spec.mjs scripts/validar-migracoes-fora-de-banda.spec.mjs
node scripts/scan-secrets.mjs
git diff --check
```

- PASS focados:29 suítes/407 testes, incluindo migration1075.
- PASS rodada integral final do código estabilizado:343 suítes/3086 testes;
  6 suítes/127 testes SKIPPED por condições próprias. Execução final105,692s.
- PASS PostgreSQL15 final, após projeção e schema1:28 testes/29 filtrados.
  Migration1075 aplicada apenas no container descartável. Runtime NOBYPASSRLS
  e não owner, inventário de todas as tabelas tenant, ausência de tenant e
  regressões PA04–PA06. Quatro casos FOOD01: escopos/FK, criação/CAS em corrida,
  transferência/preservação/projeção e aplicação versus desativação sob lock.
- PASS guardas/migrations fora de banda:24 testes.
- PASS finais: typecheck sem erros, build Nest e verificação de dist/main.js.
- PASS: scanner local sem secrets, diff limpo e matriz de confiabilidade40
  referências. Nenhuma dependência instalada; scripts finais no Node22.

As primeiras execuções PG tiveram4 FAIL novos/24 PASS existentes. Causas:
fixture sem catálogo, rótulo repetido, nomes incorretos de contexto de governança,
falta de proveniência de importação e entidades ausentes no DataSource restrito
da prova. Corrigidas somente as fixtures; nenhum trigger/RLS de produção foi
relaxado. A fixture passou a criar catálogo/fonte/importação/alimento sintéticos
com proveniência antes da ativação sintética.

## Limites e gates pendentes

- Timescale/pgvector/hypertables SKIPPED na fixture PostgreSQL15; CI integral
  continuará obrigatório. O harness omite explicitamente essas extensões,
  sem transformar a prova focada em validação do stack completo.
- T06 BFF/UI/Playwright/Axe, regressões Web/portal/PDF e CI do HEAD final
  ainda não executados. Não declarar FOOD01 disponível por backend GREEN.
- Revisão própria é da autoria. Revisão separada/independente não executada.
- Nenhum dado real, chamada paga, dependência nova, merge, deploy ou operação
  em banco externo. Nenhuma aplicação/role/grant de staging/produção inferida.

## Implantação e rollback (execução futura separada)

Antes de publicar backend/Web, identificar ambiente/banco/branch/role e obter
requisição operacional de migration1075. Aplicar fora de banda com owner;
verificar registro, coluna de versão, tabela, FORCE RLS/policies e privilégios
DML mínimos da role runtime real. Não presumir grants por sucesso no CI.
O ORM novo requer a coluna1075; migration precisa preceder o código novo.
Rollback de código conserva schema/ciphers/histórico; down destrutivo recusado.
Desligar o novo fluxo não apaga medidas, publicações ou snapshots legados.
