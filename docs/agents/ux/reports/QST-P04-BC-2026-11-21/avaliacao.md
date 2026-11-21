# QST-P04 — UX B/C e revisão cruzada

## Modalidade e escopo

Persona profissional fictícia `/root/qst_p04_ux_a`, independente da escrita,
em duas retomadas de revisão estática do wrapper, integração, testes e Modal.
Sem execução própria de testes nem inspeção visual própria. Não é revisão R4
clínica nem validação com usuários. Papel fonte igual ao manifesto A.
Paciente N/A: nenhum fluxo, conteúdo ou envio ao paciente foi alterado.

## B — primeira integração

Revisor confirmou reutilização de renderer, estado local, aria-pressed, limite
max-width e medição ResizeObserver. Hipóteses: overflow com fonte200 e ausência
de prova de storage. Coordenador executou 18 cenários e inspecionou captura
mobile200. Controles legíveis, corpo rolável; a primeira captura não mostrava
o conteúdo inferior. Foi acrescentada prova de alcançar o título por rolagem.

## C — encerramento

Parecer estático favorável, sem defeito bloqueante concreto. Revisor conferiu
Modal: Escape, Tab, retorno de foco, nome/descrição e corpo rolável. Aviso foi
precisado: não emula aparelho/navegador. Medição reinicia ao abrir.

Provas do coordenador: 8/8 P04 após storage/Tab/aviso; 2/2 acessibilidade após
assert adicional de alcance por scroll. Resultado não é execução independente.
Desktop/celular, axe, texto200 e retorno ao gatilho aprovados nesses cenários.
Capturas anexas são sintéticas, não pacientes reais.

## Consolidação e aprendizado D

| ID | Origem | Problema/hipótese | Prioridade | Decisão e evidência |
| --- | --- | --- | --- | --- |
| NUX-P04-01 | A | Largura confundida com aparelho real | P1 | JÁ COBERTO: valor solicitado e efetivo, aviso explícito; PW mede largura |
| NUX-P04-02 | A | Perder edição/contexto | P1 | JÁ COBERTO: mesmo renderer, estado local, key por questionário; edição/storage/requests e contexto testados |
| NUX-P04-03 | A | Controles/conteúdo inacessíveis em espaço estreito | P1 | JÁ COBERTO nos cenários executados: max-width, fonte200, Tab/Escape, scroll até título e axe |
| NUX-P04-04 | C | Modal compartilhado não usa inert no fundo | P2 | BACKLOG: teclado contido, aria-modal presente; leitor de tela humano não executado. Limitação preexistente, sem regressão demonstrada. Avaliar separadamente sem alterar Modal nesta PR |

Complexidade deste incremento baixa, impacto de apresentação R2; nenhuma nova
fronteira de autorização ou armazenamento. Não chamar a simulação de teste de
portal/dispositivo. Preservar uma instância por vez e largura efetiva em fases
futuras. Nenhuma nova decisão clínica ou expansão automática de produto.
