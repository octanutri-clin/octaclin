# QST-P04 — prévia por largura no editor

## Estado

Implementação local e validação direcionada concluídas; CI do novo HEAD pendente.
Continuidade autorizada das pequenas melhorias profissionais. O coordenador
apresentou a solução e tratou 390/1024 px como escolhas técnicas reversíveis
desse escopo; não houve resposta específica do proprietário aprovando esses números.

Branch `feat/qst-p04-previa-dispositivos`, base `9adc6d2e` da #566.
Funcionalmente independente de #567/#568: não alterar a leitura de respostas.
A base #566 preserva a reconciliação de governança ratificada; não copiar ou
integrar branches automaticamente. PR Draft contra main: #566 foi mergeada externamente em 45470c5b;
9adc6d2e é ancestral, sem diferenças nos quatro arquivos funcionais afetados.
Nenhum merge ou integração foi realizado por este incremento.

Inspeção em 21/11/2026: main `60bbe01f`, área de questionários sem mudanças
funcionais da FOOD06 neste incremento. Nenhuma worktree alheia foi modificada.

## Evidência e menor solução

- `octaclin-web/components/questionarios/area-editor.tsx`: três colunas no xl,
  com mínimo 320/320/360 px; prévia existente na terceira coluna. Alterar apenas
  sua largura nesse lugar não produz uma visualização desktop ampla.
- `preview-questionario-paciente.tsx`: reutiliza `criarCampoPreview`, ordena por
  `ordem` e agrupa por seção; controles e envio desabilitados. Não é formulário
  de submissão nem prova de funcionamento real no portal.
- `components/ui/modal.tsx`: modal existente com título, fechamento, tratamento
  de Tab/Escape e retorno de foco. Reusar sem alterar o componente compartilhado.
- `tests/visual/questionarios-editor.spec.mjs`: já protege a prévia lado a lado;
  conservar esse comportamento e a proteção contra alterações não salvas.

Referência já pesquisada: [SurveyJS — prévia por dispositivo](https://surveyjs.io/survey-creator/documentation/end-user-guide/user-interface#preview-tab).
Usar somente o padrão de interação, sem copiar código ou adicionar dependência.

## Escopo implementado

1. Manter a prévia inline existente ao abrir o editor.
2. Acrescentar **Ampliar prévia**, abrindo a apresentação no modal existente.
3. Oferecer **Celular — 390 px** e **Desktop — 1024 px**, ambas limitadas à área
   realmente disponível. Se o limite impedir a largura solicitada, indicar isso;
   não dizer “1024 px” quando o conteúdo está sendo exibido a 350 px.
4. Usar uma única instância do mesmo componente por vez, sem duplicar campos,
   rótulos ou focos no documento. Nenhum segundo motor de formulários.
5. Mensagem curta: “Simulação de largura. Confira também em um aparelho real.”
   Não chamar isso emulação de dispositivo, de media queries ou teste de leitor
   de tela. A largura não altera o viewport real do navegador.
6. Alternar largura não altera título, perguntas, opções, seção, ordem ou
   obrigatoriedade; não salva, envia ou dispara chamadas adicionais.
7. Estado só em memória, reiniciado ao trocar questionário/remontar o editor.
   Fechar retorna ao gatilho e preserva todas as edições pendentes.
8. No celular e em fonte ampliada, respeitar a largura disponível sem exigir
   rolagem horizontal para acessar controles. Sem escala CSS que torne texto
   pequeno para caber artificialmente.

O planejamento inicial e o relatório A registraram uma solicitação de decisão.
Esse checkpoint foi substituído pela decisão do coordenador de prosseguir dentro
da continuidade autorizada. As sugestões não autorizam mudar preenchimento do paciente.

## Escopo técnico fechado proposto

Arquivos candidatos: `area-editor.tsx`, pequeno wrapper profissional de apresentação
se justificar separação, `tests/visual/questionarios-editor.spec.mjs`, handoff e
relatórios UX. `PreviewQuestionarioPaciente` só deve mudar se necessário para
encapsular essa apresentação, preservando seu contrato e seus consumidores.

Não alterar workspace de persistência, API/BFF, schemas, permissões, respostas,
snapshots, envios, portal, FOOD06 ou lockfiles. Evitar mudança em Modal/PortalShell
compartilhados: se houver limitação material, registrar e parar só o item afetado.

Risco de apresentação estimado R2; elevar se surgir nova fronteira de dados.
Rollback somente do incremento visual. Sem merge, deploy ou migrations.

## Matriz de provas

| Critério | Prova |
| --- | --- |
| Ação disponível e largura efetiva | RED funcional antes da implementação; medir bounding boxes das duas larguras em viewport apropriado |
| Compatibilidade | Prévia inline continua; título, ordem, seções e controles permanecem os mesmos; sem envio habilitado |
| Dados e edições | Comparar conteúdo antes/depois; nenhum request ou storage novo ao abrir/alternar/fechar; rascunho não perdido |
| Teclado | Tab/Escape, nomes/estado dos controles, foco visível e retorno ao gatilho |
| Responsividade | Desktop/mobile, fonte200%, limites honestos e ausência de overflow horizontal obrigatório |
| Contexto | Troca de questionário, desmontagem e reabertura sem transportar conteúdo/preferência indevida |
| Qualidade | Lint/typecheck afetados, regressões do editor e preview; UX B/C com interface real; revisão independente e CI do SHA correto |

## Execução e resultados

Código validado: `b0db79a2f503f799aec103411656fb5f0ca14258`.
O commit documental posterior não altera implementação ou testes.

- RED funcional: editor carregado, ação “Ampliar prévia” ausente; teste falhou
  no click correspondente. Uma execução adicional iniciada antes da aplicação
  foi interrompida; não é evidência GREEN.
- GREEN: 18/18 Playwright desktop/mobile (8 novos P04 e 10 regressões editor).
  Após reforço: 8/8 P04 (storage, Tab, aviso e medição) e 2/2 acessibilidade com
  assert adicional de alcançar título por scroll. Não são 28 testes distintos.
- Lint dos três arquivos e typecheck Web PASS, Node22.21.1; preview domínio3/3,
  linguagem8/8 e verificador de linguagem PASS. Diff e scanner local de segredos PASS antes do commit.
- Sem requests adicionais durante abrir/alternar/fechar e sem mudanças em
  localStorage/sessionStorage nos cenários. Controles da prévia desabilitados.
- UX A histórico preservado; [B/C e aprendizado D](../docs/agents/ux/reports/QST-P04-BC-2026-11-21/avaliacao.md).
  Revisão cruzada estática favorável, sem testes próprios. Paciente N/A.
- Build completo/CI/scanners remotos: pendentes no novo HEAD. Leitor de tela
  humano/usuários reais SKIPPED por indisponibilidade; axe não os substitui.
  PostgreSQL/RLS N/A: apresentação sem nova fronteira de dados/persistência.
- Dependências locais reutilizadas anteriores ao lockfile: Next16.3.8,
  React19.3.0, PW1.63.0, TS6.0.3; ramo declara Next^16.4.5, React^19.3.1,
  PW^1.64.1. CI com instalação canônica ainda necessário.
- Servidor iniciado dentro de octaclin-web, Chromium local, configuração
  temporária herda a do projeto e só ajusta endereço/executável/saída.
  Nenhuma dependência, workflow ou timeout alterado.

## Handoff

Próxima ação: conferir CI do HEAD enviado e comentários da PR Draft. Não mergear,
deployar, migrar ou alterar FOOD06. Sem mudança no Modal compartilhado, portal,
BFF, API, autorização, snapshots, lockfile ou armazenamento.
