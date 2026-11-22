# QPRO-01 — UX profissional B/C

Base `9b9747d4203e8b798af4ee69b81e8ffb42892803`. Decisão humana: duas opções de
CSV, filtrado por paciente/busca ou completo. NUX-01 do inventário A/D foi
reutilizado, sem repetir pesquisa nem transformar novas ideias em obrigação.

Instância `/root/qst_auditoria_nutri`, retomada por followup com papel explícito
baseado no TOML profissional; sem seleção nativa, ferramentas ou interação
própria. Entrada: relato sanitizado dos rótulos, mensagens, seleção por IDs,
limites, negativas e dois testes iniciais aprovados desktop/mobile. Resultado
abaixo é síntese editorial da resposta. Timestamps exatos não foram capturados.

Parecer favorável: duas ações e explicação de que se exportam todos os campos dos
envios exibidos resolvem a ambiguidade. Limite1000 aceitável com orientação e sem
truncamento. Descartar download em mudança de contexto mantém correspondência.
Hipótese residual: alguém pode esperar só a pergunta que corresponde à busca;
o texto aborda isso, mas compreensão com usuários reais não foi validada.
Nenhuma sugestão adicional foi convertida em escopo. Não constitui validação
clínica, R4, autorização de merge ou aprovação de CI.

Paciente N/A: exportação exclusivamente profissional, sem compartilhamento
automático, mudança de portal ou prescrição. B visual pela persona NOT RUN.

Coordenador inspecionou capturas reais do grupo de exportação com dados
sintéticos, ambas com texto200%, Next/Chromium e emulação Pixel5. São recortes do
componente, não prova de toda a jornada nem leitor de tela manual:

- [Desktop](desktop.png)
- [Mobile](mobile.png)

Os testes posteriores de teclado, axe, negativos e descarte tardio foram
consolidados no [handoff técnico](../../../../../tasks/qst-qpro01-exportacao-csv.md),
sem reescrever o escopo parcial da entrada original da persona.
