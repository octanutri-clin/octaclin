# FOOD06 — brief sintético, etapa A, expansão M01–M12

Base avaliada: PR #455, `eeb552fa`, antes de interfaces FOOD06. Escopo ampliado
aprovado integralmente pelo proprietário em 2026-10-31; todas M01–M12 obrigatórias.
Modalidade: avaliação independente da proposta/auditoria, sem interação ou telas.
Papéis/procedimento: arquivos da #451 no commit explícito `0d3382b6`, por ponte
textual do runtime, sem seleção nativa comprovada dos TOMLs. Não ler outros dados.

## Fatos e decisões aprovadas

- Adultos 19+, aparentemente saudáveis, sem gestação/lactação; sexo da referência
  e contexto confirmados por profissional. CL01–CL08/quadro DRI ratificados.
- Apenas console profissional; nenhum novo conteúdo/compartilhamento no portal.
- Seleção combinada representa mesmo dia planejado somente após confirmação;
  sem confirmação existem totais factuais, sem percentuais das referências diárias.
- Tabagismo confirmado soma 35 mg somente à RDA C; desconhecido impede só essa RDA.
- RDA/AI/UL não são diagnóstico, metas individuais automáticas ou ingestão real.
  UL restrito por forma/origem permanece indisponível se a composição não o distingue.
- Núcleo isolado existe e tem testes sintéticos, sem tabela clínica/rota/UI.
  Direitos das tabelas ainda em conferência; não presumir liberação assistencial.
- PA06 soma apenas snapshots das porções dos itens efetivos selecionados e ativos.
  Suas saídas têm completo/parcial/indisponível e contagem com valor/incluídos.
  Atualmente não explica todas as causas nem lista contribuições. Não conta
  automaticamente alternativas disponíveis/preferidas como consumo/plano efetivo.
- FOOD04 e FOOD07 integram o código da base; FOOD05 #446 está fora desta base.
  Funcionalidade dependente deve ser protegida, sem criar motor de equivalências.
- Não foi encontrado nesta inspeção um contrato confiável de alergias/restrições
  estruturadas com regras de compatibilidade alimentar. Texto livre não autoriza
  inferência; sugestões personalizadas M11 precisam dessa verificação adicional.
- Histórico de planos tem snapshots cifrados e versões, mas não um registro
  FOOD06 de análise com contexto/referências; não alterar snapshots publicados.

## Melhorias aprovadas e ondas propostas

- A: M01 cobertura por nutriente/causas/fontes; M03 motivos estruturados;
  M05 rastreabilidade de autoridade/documento/versão/população/regras;
  M09 textos acessíveis sobre RDA/AI/UL, parcial e limitações.
- B: M02 contribuição dia/refeição/alimento, porção e ordenação com denominador
  válido; M06 tabela filtrável/ordenável/acessível por vitaminas/minerais,
  cobertura, referência indisponível, abaixo/acima matemático e UL aplicável.
- C: M04 prévia de alteração antes/depois sem gravar; M11 alimentos do catálogo
  autorizado com teor conhecido por porção/preparo e restrições confiáveis;
  M12 cenários temporários lado a lado, macros/micros/cobertura, revisão/fingerprint,
  confirmação explícita, sem principais/alternativas simultâneos.
- D: M07 duas versões autorizadas, separar dieta/fonte/referência/contexto/cobertura;
  M08 relatório profissional PDF autorizado no backend, mínimo necessário,
  sem compartilhamento automático; M10 gráfico longitudinal com tabela e lacunas,
  sem continuidade artificial ou inferência de melhora do estado nutricional.

## Proposta de fluxo e contratos (não é interface observada)

O profissional abre a análise na seleção/plano, confere contexto e dia planejado,
vê primeiro quantidade conhecida/cobertura e comparação quando aplicável. Detalhes
expansíveis mostram origem, refeição/alimento e motivos; edição não acontece aqui
sem prévia/confirmar. Cenários ficam só em memória até confirmação autorizada;
uma análise deliberadamente salva para histórico é um registro distinto da
simulação temporária. Esse registro novo não publica plano nem envia ao paciente.

Estados propostos M01: indisponível para impedimento técnico/contratual;
incompatível para unidade/forma não combinável; parcial se parte conhecida;
desconhecido quando nenhum valor compatível existe; completo se todos conhecidos.
Contagens por motivo e subtotal compatível permanecem visíveis; cobertura por
quantidade de itens não é percentagem de confiabilidade científica.

## Cenários sintéticos

1. Consulta rápida: refeição com dois alimentos, um tem ferro conhecido zero e
   o outro ferro desconhecido; cálcio conhecido em ambos. Comparações parciais
   não aparecem como adequação. Explique o que abrir para localizar a lacuna.
2. Dois planos são dias alternados. O profissional seleciona ambos; não pode
   receber comparação diária sem confirmar que representam o mesmo dia pretendido.
3. Substituir alimento A por B, um de cada vez, muda composição/cobertura. Cancelar
   preserva o plano; uma outra aba modifica o rascunho antes da confirmação.
4. Receita FOOD07 para 1,5 porções: dados congelados das quantidades ajustadas
   são usados uma vez, sem novo fator de rendimento; instruções não são editadas.
5. Catálogo de ferro: candidatas têm preparos/porções diferentes, uma sem dado.
   Há declaração sintética de restrição a amendoim, sem regra estruturada validada.
   Não inventar segurança/compatibilidade ou tratamento de deficiência.
6. Relatório profissional pode ser mostrado manualmente pelo profissional a um
   paciente fictício no celular. Não há compartilhamento automático no portal.
   Uma análise antiga usa referência/fonte diferente; gráfico deve separar séries.

## Saída requerida

Cada persona avalia sem ver o parecer da outra e sem ferramentas, rede, arquivos,
pacientes ou credenciais. Entregar pontos positivos, dificuldades, riscos e
oportunidades. Para cada achado: ID NUX/PUX, cenário/objetivo, comportamento proposto,
dificuldade, tipo (defeito comprovado/risco plausível/hipótese/sugestão/estética),
evidência/hipótese, impacto, sugestão específica, aceite verificável, P0–P3.
P0 exige evidência concreta; não há teste real de UI neste brief. Paciente deve
marcar navegação de portal N/A e avaliar somente impactos reais de relatório ou
alteração posterior do plano, sem inventar nova exposição no portal. Não ratificar
clínica/direitos, mudar escopo ou declarar revisão R4/testes com usuários reais.
