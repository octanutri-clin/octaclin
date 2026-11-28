# C2-F01 — evidências fornecidas nas etapas B e C

Base `0fd46a01`, diff funcional identificado no handoff F01. Resumo editorial dos
briefs efetivamente enviados, sem credenciais ou conversa completa. Papéis da
base em `.codex/agents/`, explicitamente fornecidos em instâncias separadas.

B: coordenador executou interface Next real com HTTP sintético em Chromium
desktop e Pixel 5. Resultados login/MFA 18/18, adicionais 8/8, teclado/texto 200%
2/2. Screenshot mobile observado pelo coordenador: mensagem dentro do card,
contorno de foco, campos/botão presentes e link de recuperação quebra em linhas.
Personas não receberam a imagem nem interagiram. F01 preserva autenticação e
políticas; erro público por status, foco após falha, Caps Lock/erro associados e
trava de envio. Cópia pertence à próxima F02, não avaliar como lacuna da F01.

C: adicionados os resultados acesso/a11y 26/26, retry MFA 2/2, seletor existente
2/2 e navegação 2/2. Typecheck Node 22, lint, linguagem e secrets PASS. Nenhum
código funcional mudou desde B. R4 estática independente sem risco reproduzível,
sem execução própria. Rodada global interrompida: 33 PASS, 2 resultados FAIL e
241 NOT RUN; seletor corrigido e navegação reexecutada, sem PASS global. Build/CI
pendentes; leitor de tela manual NOT RUN; mocks não provam cookies/backend/RLS.

Critérios prévios: NUX-01/02/03/06 e PUX-01/02. Solicitar hipóteses claramente
identificadas, sem ampliar produto, fabricar consenso ou autorizar merge.
