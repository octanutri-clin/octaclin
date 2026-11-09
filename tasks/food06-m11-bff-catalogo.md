# FOOD06 M11 — BFF factual do catálogo

## Estado vigente e fronteira

Base40e0e80d, PR455 Draft. BFF implementado para a API factual da M11; sem interface ou aplicação de alimentos. M11 permanece PENDENTE como macroentrega e45,8% administrativos mantidos. M12 ainda pendente; individualização, direitos/DRI e G06 continuam bloqueados nos contratos existentes. Não inferir licença pela situação operacional da fonte.

`POST /api/planos-alimentares/catalogo/teor-micronutriente/consulta`. Sessão/permissão planos_alimentares.ler antes da leitura do body; backend continua autoridade para papel Professional, vínculo e fontes. Reutiliza exigirPermissaoBff/requisitarBackendAutenticado e leitor limitado, sem segundo mecanismo de sessão.

Corpo limitado em4KB, JSON e contrato estrito; somente codigo/porcao/busca/pagina/limite e filtros fonteCodigo/versao/baseCodigo. Sem paciente/tenant/composição/individualização no body permitido. Payload reconstruído antes de encaminhar ao path backend fixo; sem conteúdo em URL. Sinal de cancelamento propagado ao fetch e reconferido, cache no-store; nenhuma escrita.

Resposta limitada em256KB e reconstruída por allowlist em todos os níveis; estado/código/unidade/qualificador, porção e paginação devem corresponder à consulta. IDs únicos, cobertura/exclusões reconciliadas; estados desconhecidos sem números, zero conhecido preservado. Rotulo/unidade vêm do catálogo de apresentação já existente; não é outro motor nutricional. Fonte/preparo/versionamento mantidos, dados livres/aprovador/contextos não projetados. O status jurídico não é resolvido no navegador.

Erros backend têm mensagem genérica e corpo descartado; status400/401/403/404/409/413/422/429 preservados, demais503. Resposta inválida ou excessiva503sem payload interno; sempre private/no-store. Composição e limites matemáticos permanecem no backend; BFF só valida o contrato projetado.

## TDD e revisão

Stub inicial do BFF:23falhas funcionais/126passes em149testes; casos negativos503 já satisfeitos pelo stub não foram contados como RED. Implementação149/149PASS. Teste de propagação de cancelamento acrescentado:1RED/149PASS antes da correção; GREEN final150/150PASS,0skip.

R4 independente /root/food06_contexto_fundamento_r4, revisão estática do parser/route/testes/helpers e pins Docker: favorável delimitada, sem novo bloqueador. Identificou cancelamento não propagado, corrigido com teste acima; reavaliação confirmou linha e teste. Não executou testes/build nem verificou índices externos. Parecer não cobre interface, direitos ou conclusão global FOOD06.

UX A anterior permanece aplicável: consulta profissional genérica; ordem limitada à página/lote, porção comum e desconhecidos explícitos. Paciente N/A, sem portal/envio/relatório novo. UX B/C, Playwright e tecnologias assistivas NOT RUN: interface ainda ausente.

## Verificações e handoff

Comandos em Node22.21.1: node scripts/test-planos-alimentares-bff.mjs no Web; tsc --noEmit; eslint sobre os dois arquivos novos; next build --webpack. Gate test:authz iniciado pelos mesmos comandos node do package.json, em sequência, sem mudar configurações ou usar pnpm11.19.0local como se fosse o11.25.0declarado. BFF150/150PASS, autorização central de rotas30/30PASS, typecheck/lint PASS e linguagem da interface PASS. O gate agregado test:authz foi iniciado e parou antes dos testes no primeiro harness: TS5033/EACCES ao tentar gravar /octaclin-correlacao-*/tsconfig.tsbuildinfo; também houve TS6053 durante regeneração simultânea de .next/types. Estado BLOCKED por setup, sem aprovação global ou reclassificação como RED funcional. Não se alteraram runners gerais/asserts para contornar o problema. O runner específico dos planos já isola include e cache temporários e concluiu150testes. Build final Node22/Nextwebpack PASS,196páginas; rota nova presente. Aviso existente de depreciação middleware preservado. Testes da biblioteca de linguagem8/8PASS e varredura completa de microcopy PASS. Sem teste browser neste incremento sem interface.

Correção de CI de imagens necessária e isolada em [zlib](food06-ci-zlib.md); build Docker localBLOCKEDTLS e novoCIpendente. Não validação de imagem por testes textuais.

Próximo: interface profissional com busca/nutriente/porção e filtros, página explícita/sem ranking global, fontes/preparo, carregamento/erro/vazio, desconhecidos, cancelamento/respostas tardias e teclado/mobile. Executar UX B/C sobre interface real; nenhuma aplicação ou sugestão personalizada sem contrato seguro. Reutilizar prévias existentes para a etapa de confirmação posterior.

Rollback: retirar route/lib novos e entradas dos testes; sem migration/dado persistido. Sem merge/deploy/migrations externas/Render/Neon.

CI oficial executa test:authz antes do build; será necessário conferir o resultado completo no novo HEAD. O problema local do harness não autoriza desabilitar esse gate ou declarar o agregado aprovado.
