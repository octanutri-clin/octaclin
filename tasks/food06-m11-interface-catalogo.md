# FOOD06 M11 — primeira interface factual do catálogo

## Escopo do incremento

Base b0c1f4dc, PR455 Draft. Consulta genérica profissional integrada ao painel de micronutrientes do cálculo combinado. Reutiliza BFF/API/motor existentes; não altera alimento, refeição, plano, publicação, snapshot ou grupo FOOD04. Não apresenta adequação, referência DRI, ranking global ou compatibilidade individual com restrições. Individualização continua bloqueada pelo contrato de restrições não validado. Prévia/aplicação da seleção e demais requisitos M11 continuam pendentes; M12 não implementada.

## Interface e segurança

- Abertura e consulta explícitas, sem chamadas enquanto o formulário está fechado. Nome2–120caracteres, nutriente do catálogo de22códigos, porção comum0,001–10.000g até3decimais, vírgula ou ponto; fonte por identificador real dos adaptadores TACO/USDA/IBGE. Dropdown não declara direitos; API filtra fontes autorizadas/ativas/aprovadas.
- Porção digitada só é normalizada como número; nenhum novo motor de composição. SDK reutiliza parser/projeção do BFF e erro tipado existente, POST privado e sinal de cancelamento. Não há identificador de paciente/tenant no pedido.
- Resultado vinculado ao pedido confirmado: nome/preparo, porção consultada/100g, estado e fonte/versão. Ausência/traço/incompatibilidade sem número; zero conhecido distinto. Positivo arredondado a zero recebe aviso textual, e valores pequenos de apresentação usam o formatador existente.
- Seleção de páginas por nome/ID, teor ordenado somente entre os alimentos da página. Avisos de catálogo mutável, bases/unidades e cobertura em contagens; nenhuma porcentagem de confiança científica.
- Mudança de qualquer campo/fechamento/cancelamento/nova consulta incrementa geração, aborta pedido anterior e limpa resultados/erro. Callbacks conferem geração e sinal antes de atualizar ou invalidar acesso.401/403 vigentes removem dados e invalidam leitura no pai; negação tardia antiga não invalida contexto novo.
- Key do componente inclui paciente/contexto/permissão; desmontagem invalida pedidos. Matriz executou troca de seleção e401/403; troca direta de paciente ainda não exercitada nesta suíte e não deve ser inferida de mocks. Nenhum cache persistente/log/telemetria novo.
- Paginação anterior/próxima, máximo10.000páginas com refinamento de busca; falha não conserva página anterior como se fosse válida. Região tabular focável com indicação visível de rolagem; estados de carregamento/vazio/erro/cancelamento acessíveis. Sem nova dependência ou migration.

## TDD e verificações

RED funcional browserdesktop: plano e cálculo carregados, botão da consulta ausente. Implementado fluxo e GREEN normal1/1 com teclado/axe e200% de fonte. Primeira matriz interrompida para corrigir um locator de select:8PASS/1FAIL/1interrompido/70NOTRUN. Troca pelo role/nome acessível do combobox não reduziu asserts ou aumentou timeout. Corrigida também preparação do cenário de seleção; retestes filtro/seleção2/2PASS. Nova matriz completa:74PASS/6SKIPPED/0FAIL, incluindo20casos novos PASS e54regressões PASS. Os6PDFs opt-in antigos não foram executados nesta rodada; não são PASS.

Fixture inclui zero, ausência, traço, unidade incompatível, positivo abaixo da precisão, filtro de fonte/porção1,5, paginação, erro503e repetição,401/403, cancelamento, resposta tardia e remoção/reinclusão do plano. Browser usa BFF interceptado com dados sintéticos; não é prova de autorização/SQL/RLS. Provas anteriores da API permanecem históricas dos respectivos commits; backend/PG não foram alterados ou reexecutados neste incremento.

Lint CIb0c1f4dc: fixture nova usava any; erro reproduzido localmente no spec. Corrigido por inferência e remoção de campos no teste negativo, preservando asserts. Lint integral localPASS,0erros/71avisos existentes. BFF150/150reexecutadoPASS; linguagem completa e seus8testesPASS; typecheck e lint dos componentes/SDKPASS. Build final isolado Node22/webpack PASS,196páginas,5inputs de código conferidos por SHA256 contra a worktree e BUILD_ID presente; CI do delta pendente. Avisos existentes de middleware/Edge Runtime preservados. Gate agregado authz local continuaBLOCKED pelo harness já documentado, não encerrar por um subconjunto.

## Revisões e evidências

R4 independente /root/food06_contexto_fundamento_r4, leitura estática de componente/SDK/key do pai e matriz: favorável delimitada, sem bloqueador concreto. Não executou testes. Limitações identificadas: mocks, ausência inicial de401/troca de contexto; incluídos401e seleção, mas sem teste direto de troca de paciente. Não é revisão integral FOOD06, clínica ou operacional.

UX A/B por /root/food06_contexto_ux_a, persona fictícia e subagente separado: A sobre proposta; B sobre evidências textuais da interface/navegação real fornecidas pelo coordenador. Sem interação própria ou inspeção direta de screenshot pelo revisor. Solicitações de ordem limitada à página, bases explícitas e limpeza incorporadas; indicação perceptível de rolagem e teste de teclado acrescentados. PacienteN/A, sem portal/envio/relatório novo. Não houve teste com usuário real, leitor de tela humano ou validação clínica.

Screenshot sintético do coordenador observado com200%: labels legíveis, tabela larga contida e fonte/versão acessível por região horizontal; não comprova todos os dispositivos. Artefatos reproduzíveis em tests/visual/food06-consulta-teor.spec.mjs (consulta-teor.png), não versionar imagens geradas por padrão.

## Próximo passo e rollback

Conferir CI no HEAD enviado e completar prévia/seleção com contratos existentes M04/M12; sem aplicação automática ou individualização não validada. M11 passa de PENDENTE para PARCIAL (consulta API/BFF/UI utilizável e20cenários testados),50%administrativos pelo método fixo; não está concluída; direitos/DRI/G06 BLOCKED. Critérios globais e revisão integral FOOD06 pendentes.

Rollback: remover a integração/componente/SDK novos, preservando API/BFF anteriores e dados imutáveis. Sem alteração de schema ou histórico; sem merge/deploy/migrations externas/Render/Neon.

O gate authz completo foi reiniciado sem editar runners: TMPDIR=/tmp/food06-review/octaclin-web/.tmp-authz-food06, comandos node do test:authz em sequência e Node22. O diretório temporário dentro da worktree evita o caminho de cache fora do ambiente gravável. Primeiros grupos aprovados; agregado ainda em execução, não PASS antecipado. Build em cópia descartável gitarchive+delta de5arquivos, symlink de dependências existente e webpack; hashes dos inputs conferidos, sem modificar config/segurança para contornar setup. Nenhuma imagem ou ambiente externo construído/implantado nesta rodada.

UX C delimitada favorável após74PASS/6SKIPPED; [relatórios e manifesto](../docs/agents/ux/reports/FOOD06-M11-INTERFACE-B-2026-11-06/consolidado.md). Não é C global nem revisão humana. Build e typecheck isolados concluídos com os mesmos arquivos de código; authz agregado continua em execução até resultado completo.
