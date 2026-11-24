# QST10-09 — B/C, somente cenários sintéticos

Papéis canônicos em `.codex/agents/`; procedimento A/B/C/D vigente. A etapaA e a
aprovação D09-01 estão no relatório QST10-09-10-AD-2026-11-23 e no plano das10PRs.
Escopo profissional: lista por formulário/paciente,25/página, estado, frequência
humana, fuso, próxima ocorrência. Pausa só novas gerações; reconfirmar não retoma
pausa/encerrado. Retomada separada, sempre futura. Sem cron editável, lote ou
canal novo. Paciente: impacto indireto, preservar envios/links/rascunhos e prazos
originais. Nenhuma interface/capacidade nova no portal.

Interface utilizável observada pelo coordenador: abaDistribuições → paciente →
Atualizar agendamentos → ação → conferência inline com formulário/paciente,
frequência/fuso/ação/próxima prevista → confirmar/cancelar. Foco na confirmação,
cancelar semPOST, ACK antes do sucesso, revisão nova, erro seguro e nova consulta
após409. Sem ator/tenant interno em projeção; troca de contexto ignora resposta
tardia. Execução única vencida: Retomar desabilitado, nenhuma data inventada.

B: desktop5PASS; mobile3PASS/1INCONCLUSIVO(dev overlay)/1FAIL real de overflow200%.
Correção local reflow de botões/fieldset. Depois12PASS no conjunto14;2falhas eram
um seletor inexistente na abaDistribuições, corrigindo a jornada do teste pela
abaFormulários houve2/2PASS. Não atribuir14PASS ao run anterior. Axe/zoom/teclado,
paginação, cancelamento e ACK cobertos. Coordenador examinou captura real mobile
200% com textos/controles legíveis sem overflow; captura local não arquivada.

As personas recebem descrições da interface real e resultados sanitizados, não
operam o navegador nem veem a captura por conta própria. Não alegar interação,
leitor de tela manual ou pesquisa com pessoas. O coordenador executa e observa.
Microcopy posterior usa mensagens seguras locais (sem JSON/corpo bruto) e
explicita que os prazos de links anteriores não mudam; validação final dirigida
pendente no momento deste brief. C será registrada em adendo, sem reescreverB.
