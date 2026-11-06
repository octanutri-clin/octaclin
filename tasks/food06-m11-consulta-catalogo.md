# FOOD06 M11 — auditoria e fundamento factual do catálogo

## Estado vigente

PR #455 Draft, base 6c0ca464. CI da base: run42236610758 concluído com sucesso, consultado nesta retomada; não comprova este delta. M11 permanece PENDENTE: somente fundamento interno implementado, sem endpoint, UI ou operação no paciente. Percentual administrativo mantido em45,8%. M12 pendente; direitos/DRI e G06 BLOCKED.

## Auditoria e reutilização

- `ServicoPlanosAlimentares.buscarAlimentos`: catálogo autorizado/paginado existente. Sua seleção de fonte ativa não substitui a verificação específica dos direitos exigida por esta consulta futura.
- `dados/micronutrientes-fonte.ts`: adaptadores TACO, USDA e IBGE; formas, unidades, traço e ausência preservados.
- `dominio/micronutrientes.ts`: normalização racional e snapshot8decimais existentes; sem segundo motor ou dependência nova.
- `FonteComposicaoAlimentoOrm`: situação e direitoUsoStatus disponíveis; esses atributos não são prova de licença comercial.
- Busca nos contratos/ORM/DTOs de paciente não encontrou mapeamento validado de alergias/restrições para alimentos. Preferências de comunicação e texto clínico livre não servem como substitutos. Individualização permanece bloqueada; consulta genérica factual pode avançar independentemente.

## Contrato interno

`prepararConsultaTeorCatalogo` aceita somente código conhecido e porção numérica0,001–10.000g, até3decimais, e lote denso de até100candidatos resolvidos pelo servidor. Não é DTO HTTP, autorização ou capability. Metadados aninhados são destinados aos adaptadores do catálogo, não a payload arbitrário do navegador.

Filtro defensivo de fonte ativa/direito aprovado; exclusões em contagens, sem retornar itens excluídos. Projeção por allowlist: identidade, nome, preparo, fonte/versionamento, base/porção e estado/valor do nutriente escolhido. Outros nutrientes ausentes não impedem resultado independente. Não infere preparo, unidade, densidade ou equivalência de formas.

Ordem apenas no lote consultado por valor apresentado na porção,8decimais, desempate por identificador; desconhecidos ao final. Não é ranking global ou de adequação. Positivo arredondado a zero possui marcador distinto do zero conhecido. Base em string passa por Number no contrato do motor existente: não se afirma preservação arbitrária de todos os dígitos de uma string decimal.

Sem leitura/escrita de pacientes, snapshots, planos ou banco. Não registra provider/controller/rota; sem impacto nos fluxos legados.

## TDD e verificações

RED funcional: implementação provisória lançando erro produziu17falhas/14passes em31testes; as validações negativas já satisfeitas pelo stub não foram contadas como falhas. GREEN:31novos testes e32regressões dos adaptadores/motor,63/63PASS. Casos: bases/porções fracionárias, oráculos aritméticos sintéticos explícitos, zero/ausência/traço, formas/unidades incompatíveis, fontes inativas/direitos não aprovados, limites, lote esparso/duplicado, projeção e não mutação.

Comandos Node22.21.1:

```sh
node octaclin-backend/node_modules/jest/bin/jest.js --config octaclin-backend/package.json --runInBand --runTestsByPath octaclin-backend/src/modulos/planos-alimentares/aplicacao/consulta-teor-catalogo.spec.ts octaclin-backend/src/modulos/planos-alimentares/dados/micronutrientes-fonte.spec.ts octaclin-backend/src/modulos/planos-alimentares/dominio/micronutrientes.spec.ts
# no diretório backend:
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
test -f dist/main.js
```

Typecheck/build/artifactPASS. PostgreSQL/RLS, BFF, Playwright e provas de autorização deste incremento NOT RUN/N/A: módulo puro sem fronteira externa; serão obrigatórios na integração. Não herdar aprovação de provas anteriores. CI do novo HEAD pendente até consulta efetiva.

## Revisões

R4 independente `/root/food06_contexto_fundamento_r4`: leitura estática do helper/spec, adaptadores e motor; favorável ao fundamento, sem bloqueador concreto. Não executou testes/build/banco. Limitações: atributos recebidos não provam autorização/licença; metadados aninhados pressupõem candidatos server-side; conversão Number da base não oferece precisão decimal arbitrária.

UX A por subagente separado, textual: [relatórios e manifesto](../docs/agents/ux/reports/FOOD06-M11-A-2026-11-06/consolidado.md). Paciente N/A; B/C NOT RUN. Não substitui clínica, segurança ou validação com usuários reais.

## Próxima integração e aceite restante

1. Resolver candidatos e fontes no backend autenticado, em escopo autorizado/consistente; reutilizar busca/paginação e regras existentes, sem aceitar composição do cliente.
2. Contrato DTO/API/BFF com limites, projeção mínima, metadados de cobertura e ordem restrita à página/lote; testar negações, isolamento e fonte revogada.
3. Interface profissional genérica com porção/preparo/fonte e ausência explícita; UX B/C e desktop/mobile.
4. Prévia e confirmação usando M04/M12, sem aplicação automática. Dependências FOOD05/FOOD07 protegidas.
5. Individualização somente com contrato estruturado confiável de restrições, aprovação aplicável e testes. M11 completa exige os demais critérios aprovados; este fundamento não encerra a melhoria.

Rollback do incremento: retirar o helper não integrado, sem migration ou dado persistido. Sem merge/deploy/migration externa ou alteração de Render/Neon.
