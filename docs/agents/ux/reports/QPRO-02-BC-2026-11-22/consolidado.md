# QPRO-02 — revisão B/C de produto

## Brief e modalidade

Base `0023c12a08f7108eb0272090b8476018b681a1b6`, correção delimitada de leituras
tardias. Sem nova tela, coluna, acesso, exportação ou decisão clínica. O plano
A/D da auditoria própria está no commit local `9c964b03`, branch
`docs/qst-auditoria-profissional-20261122`; não foi integrado implicitamente.

Entrada sanitizada: três RED funcionais em Next/Chromium com BFF sintético,
invalidação de contexto proposta, dez casos focados desktop e dezessete de
regressão desktop já aprovados no momento da revisão; mobile ainda executando.
Coordenador viu captura real atual da lista com cards sintéticos A/B,
nome/data, botões recolher/expandir e Ler envio, sem alteração de layout.
A persona recebeu descrição desses fatos, não imagem ou interação própria.

Papel `octaclin-nutricionista-ux` fornecido por prompt à instância
`/root/qst_auditoria_nutri`, retomada por followup. Não houve seleção nativa do
TOML, ferramentas usadas pelo revisor ou execução independente de testes.
Timestamps exatos não capturados. Avaliação simulada, sem usuários reais,
credencial profissional, validação clínica, CI ou R4.

## Nutricionista — síntese editorial da resposta

Parecer favorável ao mecanismo descrito: impedir resultado/erro antigo sob nova
seleção e limpar leitura incompatível melhoram previsibilidade na consulta.
Manter a matriz dependente de Atualizar preserva o fluxo. Nenhum novo problema
relevante identificado. Não inferir conclusão mobile ou validação global a
partir dos resultados parciais recebidos.

Erro já exibido antes da troca é preexistente; registrar fora do incremento,
sem confundir com erro tardio que o patch corrige. B visual pela persona:
NOT RUN. Inspeção da imagem e execução da interface pertencem ao coordenador.

## Paciente

N/A justificado: alteração somente da leitura profissional; não muda portal,
conteúdo enviado, notificações, documento, visibilidade ou prescrição. Não foi
executada segunda persona artificialmente para uma jornada sem impacto.

## Consolidação e continuidade

NUX-02/QPRO-02 tratado no escopo aprovado: sequências de requisição e invalidação
síncrona. Estado da solução: aguarda CI do HEAD; decisão de produto para novo
recurso N/A. Resultado UX não autoriza merge ou operação.
QPRO-01/CSV e demais sugestões permanecem separadas. Para novas fases, reutilizar
a regra de que resultado, erro e loading devem pertencer ao contexto vigente.

Evidências e limitações finais são mantidas exclusivamente em
[handoff técnico](../../../../../tasks/qst-qpro02-contexto-leitura.md), evitando
reclassificar resultados parciais históricos desta entrada como aprovação final.
