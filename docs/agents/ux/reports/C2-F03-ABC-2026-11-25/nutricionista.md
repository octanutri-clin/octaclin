# Nutricionista — síntese editorial A/B/C

Persona fictícia `/root/c2_f03_nutricionista_ux`; sem ferramentas ou interação.
A baseada em brief, B/C em evidências relatadas, sem imagem própria ou pessoas reais.

| A: cenário/objetivo | Dificuldade / tipo | Prioridade | Sugestão / aceite |
| --- | --- | --- | --- |
| NUX-01 corrigir endereço entre consultas | Confirmação antiga associada ao novo email, problema relatado | P2 | Focar campo e limpar aviso; retorno antigo não restaura confirmação |
| NUX-02 rede lenta, pedir uma vez | Duplicidade relatada / prevenção de erro | P2 | Trava síncrona e espera; retry somente explícito, falha recuperável |
| NUX-03 limite ou link recusado | Risco de prazo/causa inventada, hipótese | P2 | 429 sem contador, 410 neutro com saída para novo pedido |

Positivo A: proposta ajuda tanto profissional iniciante quanto experiente/equipe,
sem remover proteção. Nenhuma pergunta material bloqueante.
B: três itens atendidos na evidência relatada; sem novo impedimento. Fonte 200%
sem overflow descrita não é inspeção visual própria; regressões ainda pendentes.
C: NUX-01/02/03 atendidos no escopo executado, sem bloqueio de UX para Draft.
Leitor de tela manual, CI/build e entrega real não comprovados. Confirmação pública
não comprova envio ou recebimento. Não aprova merge nem segurança clínica.
