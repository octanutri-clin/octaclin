# QPRO-07 — UX A/D e B/C

Base `65ec84192745ca21eb5c2951383281396fa09a51`. Papel profissional canônico
fornecido por prompt à instância `/root/qst_auditoria_nutri`, por followup,
sem ferramentas, seleção nativa TOML ou interação própria. Entrada sanitizada:
diagnóstico do callback, proposta mínima, resultados coordenados e descrição das
capturas. Timestamps exatos não capturados. Síntese editorial dos retornos.

## Planejamento e revisão

A/D favorável: retry deve repetir a leitura mantendo histórico e seleção; erro
recorrente permite tentar de novo. Indicar carregamento e verificar teclado,
desktop/mobile sem perder contexto. Nenhuma expansão de produto sugerida.

B/C favorável ao relato: painel permanece aberto, foco no cabeçalho mantém
continuidade, título não salvo é preservado e mensagem fixa evita JSON bruto.
Não foram identificados novos problemas concretos nesse relato. A persona não
executou testes; B visual por ela NOT RUN. Não constitui pesquisa com pessoas,
validação clínica, revisão R4 ou autorização de merge.

Paciente N/A: console de autoria profissional; sem conteúdo enviado, portal,
notificação, relatório compartilhado ou alteração de plano/prescrição.

## Capturas observadas pelo coordenador

Recortes do componente, Next/Chromium com dados sintéticos; não teste de uma
jornada inteira ou dispositivo físico. Capturas finais inspecionadas pelo
coordenador após correção; a anterior preserva o achado, não o estado atual.

- [Erro antes — JSON bruto sintético](desktop-erro-antes.png)
- [Erro final desktop](desktop-erro.png) e [recuperado desktop](desktop-recuperado.png)
- [Erro final mobile](mobile-erro.png) e [recuperado mobile](mobile-recuperado.png)

Estado recomendado: JÁ COBERTO no incremento para callback, foco e apresentação
segura; aprovação técnica final depende dos gates da PR. Nenhum requisito novo
de produto aprovado pelas personas. Para próximas fases, reutilizar recuperação
explícita e mensagens seguras sem apagar o trabalho do profissional.

As evidências exatas por execução ficam no [handoff](../../../../../tasks/qst-qpro07-historico.md),
incluindo o limite temporal da revisão: 54 regressões precedem a mensagem fixa;
os 4 testes afetados foram reexecutados depois. Sem inflar a contagem.
