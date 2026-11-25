# Consolidação B/C

|ID|Origem|Problema/evidência|Prioridade|Solução/complexidade|Arquitetura/segurança|Estado|
|---|---|---|---|---|---|---|
|NUX-B01 / PUX-B01|Ambas, independentemente|Overflow real mobile200%; impacto essencial não demonstrado|P2|Reflow local de botões/fieldset, baixa|Sem mudança de acesso ou contrato|JÁ COBERTO: repetição12PASS inclui axe/zoom mobile; falta confirmaçãoC|

Sem consenso fabricado: os dois pareceres convergiram neste mesmo problema,
com argumentos próprios. Correção proporcional dentro dos critérios aprovados;
nenhuma nova decisão de produto ou funcionalidade criada. Demais oportunidades
fora do escopo não são autorização. EtapaC pendente até evidências finais.

R4 independente do backend: ver handoff e ledger. Não confundir as personas com
R4. Relógio após espera foi umP2 de engenharia confirmado/corrigido, não sugestão
clínica. Leitor de tela manual/usuários reais não executados.

## Fechamento C e aprendizado D

Código f945fd3:16/16PlaywrightPASS em build de produção (7novos+1legado por
viewport), incluindo zoom200%, axe, teclado, cancelamento,409 seguro, ACK tardio
após troca de contexto e paginação. Ambos os revisores emitiram adendoC favorável
independentemente, com as limitações descritas. NUX-B01/PUX-B01 resolvidos por
reflow e provas; não é aceite humano/clínico. Não surgiu novo backlog de produto.

D para próxima entrega: usar contexto explícito e respostas porACK; preservar
seleção só quando autorizada para o mesmo paciente/formulário; validar ampliação
no componente, pois ausência de overflow global não garante controle legível.
Reconfirmar é ação distinta de retomar. Reutilizar a proteção de respostas tardias.
R4 final da entrega09 está em r4.md, separada desta simulação de produto.
