# FOOD06 — fundamento interno de contribuições (M02)

## Escopo e fronteiras

Branch `feat/food06-contribuicoes-dominio`, base `b4ccc2dd` da PR #458.
Incremento isolado do domínio M02, sem rota, BFF, interface, persistência,
catálogo novo ou coeficientes científicos. Não conclui M02 ou FOOD06.
Todas as melhorias M01–M12 permanecem obrigatórias; direitos e G06 continuam
BLOCKED. Sem merge, deploy, migration externa ou mudanças de infraestrutura.

Risco conservador R4: projeção futura de dados clínicos e refatoração do seletor
compartilhado PA06. Nenhum acesso novo a dados ou autorização foi criado.
Rollback do incremento é de código, sem alteração do formato persistido.

## Contrato implementado

- `selecionarRefeicoesCombinadas` concentra a mesma seleção ON/OFF da PA06,
  com limite global de10.000 itens. `selecionarItensCombinados` mantém o retorno
  legado `{itens, exclusoes}` por flatten dessa seleção.
- `decomporContribuicoesDieteticas` recebe seleção **já autorizada** e um dos22
  códigos permitidos. Retorna cobertura da seleção, refeições e componentes,
  usando exclusivamente o classificador/somador existentes, escala8 e porções
  congeladas. Não reescala receitas, não consulta catálogo nem soma alternativas
  apenas disponíveis com o alimento principal.
- Preserva ordem e repetições legítimas entre refeições/planos. Plano/refeição
  desligado ou não selecionado não tem seus itens lidos. Refeição ativa vazia
  permanece identificável com cobertura indisponível, sem total zero inventado.
- Participação factual da seleção/refeição: somente com parcela e denominador
  completos e denominador positivo. Zero conhecido pode contribuir0%; ausência
  não vira zero. Denominador parcial/incompatível/indisponível não ganha percentual
  do total real. Percentual arredondado half-up em oito casas; a soma dos percentuais
  apresentados pode diferir residualmente de100%. Não é percentual de RDA/AI/UL.
- Nomeia o denominador como **seleção**, sem presumir um mesmo dia planejado.
- Projeção por allowlist: IDs internos de plano/refeição, posição interna do item,
  números e causas. Não copia descrições, campos clínicos livres ou snapshots.
  `indiceItem` não é identidade persistente, autorização nem capability e não
  está exposto em API. Não pode fundamentar aplicação/cópia de equivalência.

## TDD e revisão independente

1. Stub tipado sem decomposição:15/15 testes falharam funcionalmente, incluindo
   total esperado, hierarquia, lacunas, percentuais e limites. Não foi falha de setup.
2. Implementação:62/62 nos três arquivos de contribuição, soma PA06 e cobertura.
3. Revisor `/root/food06_contribuicoes_r4`, sem coautoria/edições, encontrou P2:
   `flatMap` descartava holes de arrays internos esparsos, ao contrário do spread
   anterior; isso podia produzir completude falsa. JSON comum é denso, mas o
   contrato interno precisava preservar a semântica legada.
4. Novo teste:1 FAIL/15 SKIPPED com cobertura indevidamente completa. Correção:
   flatten por spread legado e materialização de contribuições por `Array.from`.
   Resultado:63/63. O revisor repetiu a reprodução independentemente e fechou P2:
   dois incluídos, um desconhecido, causa explícita, sem percentual e sem `null`
   de posição omitida na serialização. Sem novo achado no delta delimitado.

O revisor executou as três suítes iniciais62/62 e prova própria da correção.
Não executou banco, build global ou browser; não é R4 integral de FOOD06.
Não há interface nova para UX B/C neste incremento; decisões UX A e B/C da
interface #458 continuam válidas em seus respectivos escopos.

## Verificações desta rodada

| Verificação | Resultado observado |
| --- | --- |
| Focadas: contribuições, PA06 e cobertura | PASS63/63 após correção |
| Backend completo após estabilização | PASS3797;166 SKIPPED,375 suítes PASS/9 SKIPPED |
| Typecheck backend | PASS, repetido após correção |
| Build Nest + verificador de artefato | PASS, `dist/main.js` validado |
| `git diff --check` e scanner local de segredos | PASS |
| PostgreSQL/RLS local | SKIPPED: nenhuma nova prova real de banco nesta rodada; os166 skipped não são PASS |
| Web/BFF/Playwright novos | N/A ao delta puramente interno; CI/regressões das bases são evidências distintas |
| R4 independente | Favorável ao incremento após fechamento do P2; não integral FOOD06 |
| CI próprio | PENDENTE antes do push, sem herdar PASS da base |

Uma execução completa iniciada antes da correção observou o novo RED esparso:
1 FAIL,3796 PASS,166 SKIPPED. Não é evidência GREEN; foi repetida após estabilização.
Suítes condicionadas a banco/providers não configurados continuam skipped;
nenhum mock é apresentado como prova de RLS ou concorrência PostgreSQL.
Node22.23.4, sem alteração de engines, dependências, timeouts ou asserts.
Ferramentas locais reutilizadas conforme limitações documentadas na #458;
CI com instalação frozen é evidência separada.

## Limitação de desempenho e próxima integração

Benchmark sintético **do revisor**, Node22.23.4:10.000 itens demoraram cerca de
598–1068ms no processo local e uma projeção produziu aproximadamente2,83MB JSON.
Isso não é prova de latência HTTP ou capacidade concorrente. A decomposição
atual reaproveita cobertura dos22 nutrientes para cada subconjunto, mesmo quando
retorna um código; prioriza uma única regra matemática, sem duplicação.

Antes de integrar HTTP:

1. Medir carga concorrente e reutilizar agregação/classificação por código se
   necessário; preservar testes de reconciliação e semântica PA06.
2. Projetar detalhe paginado por nutriente, com total/cobertura da seleção inteira,
   não da página. Não devolver10.000 componentes sem limite de payload.
3. Ler dentro da fronteira transacional autorizada identidades **persistentes**,
   ordem, nome, quantidade/unidade/gramas e fonte/preparo disponíveis do snapshot.
   O serviço atual seleciona somente ID+cifra da composição; ampliar por allowlist,
   nunca devolver ORM ou snapshot bruto. Não converter posição em identidade.
4. Fixar publicação e revisão de ativação em cada página; reautorizar tenant,
   paciente/carteira e seleção.403/409 invalidam detalhes e respostas tardias.
5. Somente a composição efetivamente planejada conta. Cenário com troca explícita
   deve retirar principal, nunca somar alternativa e principal. Não inferir consumo
   do paciente por preferência/liberação de uma substituição.
6. UI: expandir/recolher, ordenar conhecidos com desempate estável, origem autorizada,
   quantidade/preparo/fonte, teclado/mobile e revisão UX B/C. Isso permanece PENDENTE.

Nenhuma dessas pendências foi apresentada como funcionalidade disponível.


## Comandos e handoff

Usados com Node22.23.4 no PATH, sem chamar instalação pnpm:

```sh
node octaclin-backend/node_modules/jest/bin/jest.js --config octaclin-backend/package.json --runInBand --runTestsByPath octaclin-backend/src/modulos/planos-alimentares/dominio/contribuicoes-dieteticas.spec.ts octaclin-backend/src/modulos/planos-alimentares/dominio/calculo-combinado.spec.ts octaclin-backend/src/modulos/planos-alimentares/dominio/cobertura-dietetica.spec.ts
# No diretório octaclin-backend:
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
# Na raiz:
git diff --check
node scripts/scan-secrets.mjs
```

Próxima ação: conferir CI do incremento e desenvolver contrato autorizado e
paginado do detalhe M02 em branch própria, seguindo os seis critérios acima.
Não habilitar comparações clínicas nem operações de produção.
