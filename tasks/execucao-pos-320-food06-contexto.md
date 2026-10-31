# FOOD06 — fundamento de contexto A2 (2026-10-31)

## Estado e delimitação

Incremento na branch `feat/food06-onda-a1`, PR #456 Draft, dependente da
#455/`0ec4cd31`. O commit anterior `d2430cee` contém cobertura e explicações.
Este incremento acrescenta apenas a resolução pura de contexto. Nenhuma nova
rota, provider, referência clínica, tabela ou gravação. A Onda A não está concluída.

Regras ratificadas CL01–CL03/CL07 da ficha FOOD06: população19+, referência
masculina/feminina explicitamente confirmada, ausência confirmada de gestação e
lactação, aplicabilidade confirmada. Dia e tabagismo têm condições independentes.
Não deduzir contexto de nomes, gênero cadastral, diagnóstico ou texto livre.

## Reaproveitamento auditado

- `idadePediatrica`/`instanteCivil`, da Fase314: usar somente validação civil e
  anos completos, sem importar classificações ou políticas pediátricas. O nome
  do helper não transforma o cálculo cronológico em protocolo pediátrico.
- `obterTimezoneClinicoDoTenant`: fonte canônica já existente, tenant verificado,
  configuração `conta_cliente`, fallback definido pelo próprio resolvedor do
  projeto. Não criar timezone próprio, usar navegador ou UTC como substituto.
- `dataIsoNoTimezoneClinico`: produzir data civil no fuso efetivo. Os testes
  usam relógio sintético e a função real; nenhuma mudança nesse helper.
- `compararNutrientePlanejado`: conservar soma, ajuste C e UL já implementados;
  integração sintética testa resultado dos dois componentes juntos.
- `ServicoPlanosAlimentares.calcularCombinado`: a futura integração deve extrair
  a obtenção autorizada de entradas sob a mesma transação e ordem de locks,
  sem chamar transações aninhadas ou confiar em snapshots do navegador.

## Contrato novo

`contexto-dietetico.ts`: entrada interna confirmada + nascimento autorizado +
data civil de análise; saída mínima com idade em anos, referência populacional
confirmada, motivos estruturados e contexto do núcleo. Não retornar nascimento
nem campos arbitrários. Entrada não é DTO público ou capability de autorização.

Idade<19, data inválida/futura, falta de população/fisiologia/aplicabilidade ou
confirmação malformada falham fechadas. Não dividir dias por365/365,25. Convenção
de29/02 reutiliza anos civis existentes: em ano não bissexto a idade avança em
01/03. Não atribuir faixas universais: cada referência continuará validando seus
próprios limites na resolução versionada futura.

Sem confirmação de mesmo dia: conservar elegibilidade populacional e totais
factuais; o núcleo recusa ambas as comparações diárias. Tabagismo desconhecido
não torna toda a análise inelegível: bloqueia somente RDA C. Quando confirmado,
o núcleo aplica35mg somente à RDA C, não ao UL. Não persistir confirmações de
forma implícita nem reabrir contexto anterior como se tivesse sido reconfirmado.

## TDD e evidências

- Primeiro erro de assinatura do teste: corrigido antes da execução funcional;
  **não considerado RED**.
- RED funcional:36/36 testes falharam contra resolvedor indisponível, com suíte
  compilando/executando. GREEN:36/36 após implementação.
- Fronteiras de fuso: oito cenários em São Paulo, Rio Branco, Tóquio e Kiritimati,
  imediatamente antes/depois de19anos. Com regressões de idade/fuso:58/58 PASS.
- Acrescentadas fronteiras explícitas30/31,50/51,70/71, além das já testadas.
- Regressão final de oito suítes: **209/209 PASS** (contexto47 e regressões
  de cobertura/explicações/núcleo/PA06/micronutrientes/idade/fuso).
- Typecheck e build Nest + verificação do artefato: PASS, Node22.23.4.
- `git diff --check` e scanner local de segredos: PASS.
- Suíte completa backend repetida após os casos finais: **374 suítes/3.772
  testes PASS, nove suítes/161 testes SKIPPED**, exit0. A primeira execução
  completa também aprovou3.772 testes; nenhum resultado interrompido foi contado.
  Skips são integrações opt-in de PostgreSQL/RLS/Redis e caminhos relacionados,
  cujas variáveis de execução não foram habilitadas. Não comprovam banco real.

Ferramentas locais: mesma limitação de instalação congelada registrada em A1
(minimumReleaseAge AWS, ts-jest cache29.4.14 vs lock29.4.15). Não alterados lock,
engines, dependências ou políticas. CI próprio é prova separada.

Comando focado reproduzível, com Node22 no PATH, a partir da raiz:

```bash
node octaclin-backend/node_modules/jest/bin/jest.js \
  --config octaclin-backend/package.json --runInBand --runTestsByPath \
  octaclin-backend/src/modulos/planos-alimentares/dominio/contexto-dietetico.spec.ts \
  octaclin-backend/src/infraestrutura/tempo/timezone-clinico.spec.ts \
  octaclin-backend/src/modulos/pacientes/dominio/idade-pediatrica.spec.ts
```

Suíte completa: a partir de `octaclin-backend`,
`node node_modules/jest/bin/jest.js --runInBand`.
Build: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`,
`node node_modules/@nestjs/cli/bin/nest.js build` e
`node scripts/verificar-artefato-producao.mjs`.

## Revisão independente

`/root/food06_a1_static_review`, instância separada, sem edição/coautoria.
Executou58/58 testes e101 provas sintéticas adicionais de entradas malformadas,
limites etários, séculos bissextos e datas estritas. Nenhum novo achado
reproduzível. Não é revisão clínica, prova de banco/tenant ou R4 integral.
Provas adicionais exploratórias não são apresentadas como testes versionados.

## Pendências e próximo passo

- Contexto ainda não chamado em runtime. Origem autorizada de data/nascimento,
  tenant efetivo, revisões e revalidação dependem da futura integração.
- Novos motivos ainda precisam de textos e projeção contextual no serviço/BFF.
- Registro versionado de referências continua bloqueado por direitos. Não usar
  este contrato para habilitar tabelas ou aceitar `elegivel=true` do navegador.
- Banco/RLS, snapshots cifrados, PA07, idempotência e exportação: NOT RUN para
  este fundamento puro; seguem obrigatórios no incremento integrado.
- UX B/C: NOT RUN, sem interface. M01–M12 continuam obrigatórias e incompletas.
- CI anterior `d2430cee`: Backend/Web/scanners PASS, Mobile FAIL, Demo ainda em
  execução na consulta desta rodada; SBOM provenance SKIPPED. Não é CI global PASS.
- G06 operacional BLOCKED; #446 e FOOD05-MDL/D18 preservadas.

Próxima ação: obter entradas nutricionais autorizadas reutilizando o caminho
PA06, com projeção factual de cobertura/contexto, sem habilitar comparação
científica bloqueada. Declarar risco R4 e provar autorização/RLS antes de expor
rota clínica. Rollback deste fundamento: reversão aditiva, sem schema ou dados.
Sem merge, deploy, migrations externas ou configuração operacional.
