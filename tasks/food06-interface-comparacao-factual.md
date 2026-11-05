# FOOD06 — comparação factual de análises salvas

Incremento M07 parcial: o profissional pode selecionar dois registros factuais já carregados no histórico autorizado e comparar valores, cobertura e dimensões documentais. A interface não atribui causalidade e não habilita referências clínicas. Valores desconhecidos não são convertidos em zero; requisições obsoletas são descartadas e a revogação de acesso limpa a visualização.

A jornada ainda não permite criar esses registros pela interface. Permanecem pendentes referência comum quando aplicável, contexto clínico completo, avaliações UX B/C, revisão R4 independente e validação integral da jornada. A comparação respeita os direitos de fontes ainda bloqueados. Não representa conclusão da M07 ou FOOD06.

## Evidências locais

- RED: testes unitários iniciais falharam por ausência do módulo da funcionalidade antes de sua implementação.
- GREEN: suíte de cálculo combinado com 72 testes, incluindo três do contrato de comparação; Playwright focado 6/6 em desktop/mobile, incluindo cancelamento de resposta tardia e revogação de acesso, com axe no cenário de comparação.
- Lint e typecheck dos arquivos afetados: PASS com Node 22. Scanner local de segredos e git diff --check: PASS. Regressão visual completa, build e CI do novo delta dependem de conclusão e confirmação; nenhuma aprovação é presumida.
- Resultados anteriores de PostgreSQL/RLS e CI aplicam-se aos commits neles identificados, não a este delta de interface.
