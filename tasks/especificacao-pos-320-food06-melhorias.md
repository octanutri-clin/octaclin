# FOOD06 — escopo obrigatório M01–M12

Decisão do proprietário em 2026-10-31: **todas as doze melhorias são obrigatórias**
para conclusão funcional, autorizadas para planejamento, implementação e testes
isolados. A divisão em incrementos não torna requisitos opcionais. Não autoriza
merge, deploy, migrations externas, infraestrutura, cobrança ou ativação produtiva.

Fontes canônicas: [plano](plan-pos-320-food06.md), [ficha clínica](../docs/product/FICHA_VALIDACAO_CLINICA_FOOD06.md),
[valores ratificados](../docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md),
[direitos/fontes](../docs/product/PARECER_FONTES_DRI_FOOD06.md),
[matriz de aceite](aceite-pos-320-food06.md). A aprovação de produto não fecha direitos.

## Invariantes e fronteiras

- Apenas alimentação **planejada**, não ingestão real, diagnóstico, tratamento,
  suplementação ou meta individual automática. Contexto populacional explicitamente
  confirmado; adultos19+, sem gestação/lactação, aparentemente saudáveis nos limites
  ratificados. Sexo da referência não é deduzido de nome/identidade/texto livre.
- DRI norte-americana com autoridade/edição/unidade/população explícitas, sem troca
  implícita por EFSA. ULs B6=100mg/dia e selênio=400mcg/dia foram ratificados com
  ciência das diferenças EFSA; não são garantias de segurança individual.
- Tabagismo sim/nao/desconhecido, confirmado: +35mg apenas RDA C se sim; desconhecido
  impede só essa RDA. UL não muda. Nenhuma inferência clínica automática.
- Seleção de múltiplos planos/refeições exige confirmação de mesmo dia para
  percentuais diários. Sem confirmação, conservar **total da seleção**, sem rotulá-lo
  como total diário ou calcular percentuais diários.
- Ausência não vira zero; completude é por nutriente. Formas/origens/unidades
  incompatíveis não são somadas. Somente conversões dimensionais comprovadas.
- Nenhuma mudança de prescrição sem prévia/confirmação. Publicações e snapshots
  históricos não são reescritos; autorização atual é revalidada em toda operação.
- Sem portal novo, armazenamento clínico em cache persistente, dados clínicos em
  logs/analytics/erros ou exportações públicas. Referências do cliente nunca bastam
  como autorização, elegibilidade, fonte científica ou valor de composição.

## Auditoria de compatibilidade (base eeb552fa)

| Superfície real | Já cobre | Gap e ação |
| --- | --- | --- |
| `dominio/calculo-combinado.ts` | Soma escala8 de porções congeladas, estados/contagens, seleção e ON/OFF, limite10.000 | M01 enriquecer causas; M02 decompor sem outro somador. Não mudar retorno legado silenciosamente |
| `dominio/micronutrientes.ts` e `dados/micronutrientes-fonte.ts` | 22 códigos, qualificadores, estados por célula, normalização/precisão | Projetar estados em motivos estruturados; não criar valor para iodo/vitK fora da whitelist |
| `aplicacao/servico-planos-alimentares.ts`, `calcularCombinado` | Papel/permissão/carteira, tenant, locks ordenados, versões/revisões, decifra após autorizar | Novo agregador deve receber a mesma visão transacional e projeções. Preservar PA06 |
| `aplicacao/projecao-composicao.ts` | Allowlist de nutrientes e fonte no snapshot | Reutilizar projeção e reforçar minimização específica da análise; não devolver entidade ORM |
| `dominio/comparacao-dietetica.ts` | Núcleo isolado, razões exatas, RDA/AI/UL independentes e causas | Resolver população/faixas no servidor, referências versionadas após direitos e conteúdo M03/M09 |
| `infraestrutura/plano-alimentar-versao.orm.ts` | Snapshots cifrados de composição/totais e revisão de rascunho | Não tem análise FOOD06 com contexto/referências. Não escrever análise nova dentro de publicação antiga |
| Web `calculo-combinado-planos.tsx`, lib/BFF correspondentes | Seleção profissional, abort, cobertura básica, no-store | M06 tabela/detalhes e M02 contribuições com origem autorizada; descartar respostas tardias |
| FOOD04 na base | Grupos, origem, seleção, cópia independente, porções, direitos/permissões | M04/M12 reutilizam aplicação existente sem alterar biblioteca; liberar/preferir continuam ações explícitas |
| FOOD05 #446 fora desta base | Não disponível aqui; não importar código por merge implícito | Guardas de capacidade para fluxos dependentes. Simulações manuais independentes não calculam equivalência paralela |
| FOOD07 `ServicoPorcionamentoReceita` | Contexto tenant, porcionamento, revisão/fingerprint, fontes autorizadas | Prévia atual expõe quatro macros; micros do catálogo são resolvidos pelo writer. M04/M12 devem resolver micros com a mesma fonte, não aceitar override cliente nem reaplicar rendimento |
| Impressão de planos/documentos no console | `window.print()` e estilos existentes | M08 necessita payload autorizado e fiel à análise, leiaute/segurança/PDF acessível comprovados; HTML acessível isolado não prova PDF acessível |
| Restrições alimentares | Nesta inspeção, sem contrato confiável de alergias/restrições com correspondência a alimentos | M11 não pode declarar compatibilidade a partir de texto livre; fechar esse contrato antes de sugestões individualizadas |

R015/R056/R057/R076 já avaliados para esta fase no catálogo. SDK OpenFoodFacts não
fornece DRI; nenhuma biblioteca nova necessária para o núcleo. Não revisar
repositórios de outras fases, copiar código ou importar bases sem direitos.

## Requisitos funcionais consolidados

### M01 — cobertura por nutriente

Informar componentes incluídos/conhecidos/sem composição, incompatíveis e não
resolvidos, causas e fontes nutricionais efetivamente usadas. Não chamar contagem
de itens de probabilidade ou confiança científica. Zero conhecido é conhecido.
Estados formais e precedência estão na [Onda A](onda-a-pos-320-food06.md).
Preservar subtotal compatível em cobertura parcial, rotulado “contabilizado;
total desconhecido”, nunca como total completo. Sem percentual RDA/AI/UL indevido.
Backend, tabela/detalhes e relatório devem usar a mesma projeção/versionamento.

### M02 — contribuições

Ao escolher nutriente: total/subtotal da seleção ou dia confirmado → refeições →
componentes/alimentos, quantidade efetiva e cobertura. Ordenar por contribuição
conhecida. Participação percentual só com denominador válido, completo e positivo;
não rotular percentual do subtotal parcial como participação no total real.
Permitir expandir/recolher e abrir origem autorizada no estado apropriado (consulta
ou edição). Não deduplicar alimentos legitimamente repetidos em refeições distintas.
Deduplicar seleção/comandos; por componente conta principal **ou** alternativa
explicitamente escolhida, nunca ambos. Receita usa porção congelada uma vez.

### M03 — causas compreensíveis

Produzir códigos/motivos no backend, com mensagem curta e detalhes sob demanda,
incluindo contexto não confirmado, falta de composição, forma/unidade incompatível,
direitos/fonte indisponíveis, revisão stale e problema técnico recuperável.
Indicar próximo passo válido quando existir; não prometer botão corretivo para
limitação que o profissional não possa resolver. Sem erros genéricos no lugar de
impedimentos clínicos conhecidos ou conteúdo sensível em logs. Mesmos motivos em
tabela/detalhes/exportação; código técnico não é texto obrigatório para usuário.

### M04 — prévias de mudanças

Em rascunho autorizado/editável: trocar alimento, quantidade/porção, receita e
preparo quando cadastrado. Mostrar antes/proposto, diferença absoluta/percentual
válido, cobertura e disponibilidade de referência, sem interpretação de melhora.
Não gravar a prévia. Comando confirmado revalida fonte, paciente, revisão editorial,
posse PA07 e fingerprint dentro da transação existente; conflitos exigem nova
conferência, sem aplicação parcial ou retry que duplique. Cancelar não altera plano,
biblioteca, outra aba ou versões publicadas. Não somar alternativas não escolhidas.

### M05 — rastreabilidade

ID estável, autoridade, documento/ano/edição, código/unidade/qualificador, tipo,
valor, população, restrições, regra aplicada e versão/hash do conjunto e motor.
Resolver somente registro autorizado no servidor, não nome solto ou payload cliente.
Análise histórica reproduz referência e contexto originais; atualização cria nova
versão e sinaliza descontinuidade, sem recalcular o passado. Direitos/atribuição
do artefato devem estar comprovados. Nenhum coeficiente/tabela ativado por aprovação
de produto apenas. Bibliografia não substitui licença.

### M06 — tabela profissional

Quantidade conhecida/unidade/cobertura/referência/tipo/percentual matemático/estado/
fonte; expandir detalhes sem navegar embora. Filtros vitaminas/minerais, completo,
parcial, referência indisponível/ausente, abaixo/acima RDA/AI e acima de UL aplicável.
Comparação usa razão não arredondada para filtros, não o número visual aproximado.
Ordenação determinística por nome/quantidade/cobertura/percentual/diferença; ausências
em posição explícita, jamais tratadas como zero. Quantidades/diferenças com unidades
distintas são agrupadas/identificadas, sem ranking clínico implícito. Mostrar filtros
ativos, linhas exibidas e limpar. Estado em texto, sem depender de cores ou vermelho
automático abaixo da RDA. Preferência apenas em memória no paciente/sessão; sem
cache clínico persistente. Desktop/mobile/teclado/leitores de tela/zoom testados.

### M07 — duas versões

Selecionar duas versões autorizadas do mesmo paciente, com data, identidade exata,
revisão, composição e contexto/ref. Apresentar antes/depois, deltas válidos,
cobertura e elegibilidade. Diferenciar dieta, composição/fonte, referência,
população e lacunas; não atribuir automaticamente causa à dieta quando não provada.
Referência comum é projeção de comparação, sem sobrescrever registros e somente se
elegível para ambos os contextos. Caso contrário, comparação correspondente
indisponível. Rascunho exige revisão editorial, não só número da versão.

### M08 — relatório profissional

Preferir PDF fiel à análise: identificação mínima autorizada do plano/revisão,
data/contexto/confirmações, totais conhecidos/cobertura, referências/percentuais
válidos, ressalvas/fontes/versão/limites. Autorização backend sobre análise e
paciente atual; não confiar na tela já aberta. Sem diagnósticos, suplemento ou
PII desnecessária. Sem envio ao portal automático ou objeto público. Reutilizar
impressão quando atender; validar PDF real, texto/ordem de leitura/legibilidade,
não apenas HTML. Arquivos transitórios sem cache persistente; retenção/descarte
reusam política clínica vigente, sem inventar prazo; cópia baixada é ação do
profissional. Gerar do registro exato, com revisão prévia do que será exportado.

### M09 — conteúdo explicativo

Textos próprios concisos, científicos e acessíveis: RDA/AI/UL, planejado versus
consumido, composição parcial, indisponibilidade e limites. Abaixo de RDA não
comprova deficiência; ultrapassar referência não é diagnóstico; abaixo de UL não
garante segurança. Fonte identificável, detalhes sob demanda, revisão técnica e
clínica existente preservadas. Não importar recomendações terapêuticas de fontes.

### M10 — evolução longitudinal

Histórico paginado por data/plano/revisão/nutriente/cobertura/referência, gráfico
e tabela equivalente com origem autorizada por ponto. Não interpolar desconhecidos,
ligar pontos parciais como completos ou conectar bases incompatíveis. Alteração
de prescrição planejada não demonstra melhora nutricional/adesão/consumo real.
Marcar mudanças de fonte/ref/contexto; registros antigos ficam imutáveis.

### M11 — consulta assistida de alimentos

Consultar catálogo permitido por teor conhecido e porção/preparo/fonte/cobertura;
base de ordenação explícita, sem preencher dado ausente, comparar porções diferentes
silenciosamente ou classificar adequação individual. Restrições/preferências só
com dados necessários, estruturados, autorizados e mapeamento validado. Não
declarar compatibilidade pela ausência de alerta ou inferir diagnóstico/texto.
Prévia antes de inserir/substituir e confirmação profissional, sem tratamento de
deficiência, suplementação ou biodisponibilidade inventada. Dependentes FOOD05
protegidos até disponibilidade; nenhuma equivalência paralela. Falta do contrato
de restrições bloqueia o caminho individualizado afetado, não reduz M11 a opcional.

### M12 — cenários

Alternativas temporárias identificadas em memória: original/troca, receita/porção,
refeição/conjunto diário, combinações autorizadas. Comparação lado a lado inclui
macros, micros, cobertura, referência, diferenças válidas e incompatibilidades.
Aplicação usa revisão/fingerprint/CAS/idempotência, autorização atual e confirmação.
Não grava/publica cenário automaticamente, muda snapshots ou soma escolhas
excludentes. Separar simulação, rascunho vigente e análise deliberadamente registrada.
Perda do contexto/sair/trocar paciente limpa cenário; avisar antes de descartar
trabalho não confirmado quando houver navegação controlável, sem promessa de
recuperação. FOOD04/05/07 e PA06 são reutilizados conforme capacidade disponível.

## Arquitetura e divisão de entregas

O núcleo puro reutiliza PA06; uma projeção efetiva de itens é compartilhada por
totais, causas, contribuições, cenários, histórico e exportação. Nunca manter um
somador no frontend ou outra interpretação de porção de receita/substituição.
Métodos de aplicação compartilham `ExecutorTenant`/EntityManager do chamador,
locks globais ordenados, fontes e revisões consistentes e transações sem efeitos
parciais. Read-only projection não concede capacidade de escrita/exportação.

M05/M07/M10 exigem análise registrada com contexto/referências. Proposta técnica:
registro imutável de análise por tenant/paciente/profissional, envelope cifrado
com schema/motor/revisões de origem, totais/cobertura/contribuições/contexto/ref e
regras condicionais. Migração aditiva **somente se** armazenamento existente
não satisfizer identidade/imutabilidade/retenção sem mutar publicações; inspeção atual
favorece entidade dedicada, reutilizando crypto/auditoria/RLS/paginação existentes,
nunca segundo prontuário. Número de migration só após conferir a sequência real.
Auditoria mínima de ação, sem corpo/contexto clínico. Role runtime sem DDL,
FORCE RLS, carteiras revalidadas, projeções allowlist e rollback sem perder história.

Sequência de PRs propostas, cada uma Draft até seus gates:

1. #455: pesquisa, ratificação e núcleo isolado, planejamento completo M01–M12.
2. Onda A1: domínio de cobertura/causas, catálogo de motivos e textos, contratos
   de rastreabilidade; sem habilitar tabelas enquanto direitos bloqueados.
3. Onda A2: resolver contexto/referências, serviço/BFF e persistência necessária,
   RLS/concorrência/rollback. Depende de direitos e revisão arquitetural concreta.
4. Onda B: detalhamento e tabela profissional sobre contratos A, com UX B.
5. Onda C em incrementos revisáveis: cenários/prévias compartilhados, catálogo
   assistido e dependências protegidas. Fechar restrições antes da via personalizada.
6. Onda D em incrementos: comparação histórica/gráfico e exportação segura sobre
   análises imutáveis, com UX/segurança próprias. Nenhum requisito retirado.

Branches dependentes podem usar base empilhada explícita; não presumir merge de
#455 ou FOOD05 e não mudar `main`. Retarget e sincronização só com base real conferida.
Não repetir build/check já válido sem mudança/falha que justifique; toda evidência
identifica HEAD e limitações. Falha Mobile atual fica FAIL separada, nunca verde.

## Validação e riscos

Por comportamento novo: RED funcional antes da implementação e GREEN. Oráculo
decimal independente, dados sintéticos, estados mistos, unidades/formas, zero,
arredondamento sem decisões pelo número visual e porções já ajustadas. Banco real
descartável com role runtime e RLS para persistência/authz/CAS/rollback. Negativos
cross-tenant, outro paciente, carteira transferida, acesso revogado, replay,
payload adulterado, consentimentos/visibilidade legados e leitura histórica.

Regressões PA06, FOOD04, FOOD05 quando integrada explicitamente, FOOD07, autosave60s,
ACK/respostas tardias, PA07 entre abas, publicação e snapshots. Interface desktop/
mobile/teclado/leitores/zoom, erros, filtros, tabela/gráfico e PDF real. Revisão R4
independente após implementação/correções; personas A/B/C/D não a substituem.

Riscos abertos: direitos específicos; instalação exata local bloqueada por política
de versões AWS; auditoria Mobile FAIL no HEAD eeb552fa; fontes legadas incompletas;
restrições M11 sem contrato comprovado; arquitetura/política de retenção e PDF a
verificar antes de persistir/exportar. G06 operacional BLOCKED. Nenhum gate
SKIPPED/NOT RUN vale PASS. A entrega final exige todas M01–M12 comprovadas.
