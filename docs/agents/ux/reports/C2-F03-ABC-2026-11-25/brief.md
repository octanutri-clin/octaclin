# C2-F03 — síntese editorial dos briefs A/B/C e entrada D

Base main0fd46a01; plano aprovado por referência cb39c2c5, seção F03. Só casos
sintéticos. Papéis versionados `.codex/agents/`, procedimento A/B/C/D.

A: recuperação existente mantém mensagem arbitrária e confirmação ao editar,
sem trava síncrona/foco. Backend responde genericamente e limita antes da consulta;
não fornece prazo ao navegador. Proposta: confirmação condicional fixa, endereço/
spam, corrigir email, retry explícito, espera e respostas antigas descartadas.
Sem mudar tokens/reenvio/canais; diagnóstico já autorizado preservado. HTTP410
engloba expirado/usado/revogado, usar título neutro. D reutiliza lições F01/F02:
mensagem pública, foco e contexto, axe não prova leitor de tela.

B: coordenador executou 28/28 principais e 4/4 adicionais; typechecks e linguagem
PASS; lint 0 erros/1 aviso antigo. Captura mobile a 200% observada pelo coordenador:
mensagem e orientação dentro do cartão, sem overflow. Teclado percorre status,
Solicitar novamente, Corrigir email, campo. Personas recebem descrição, não imagem.

C: regressões 36/36 e backend sintético 23/23; R4 estática favorável. Backend
compara usuário ativo/ausente no mesmo tenant, SMTP sucesso/falha; não prova HTTP,
timing, RLS ou entrega. CI/build pendentes, leitor de tela manual NOT RUN. Nenhum
código funcional mudou entre B/C. Não aprovar merge nem apresentar email como entregue.
