# QST-P05 — duplicar pergunta salva no mesmo rascunho

## Estado vigente

Primeiro incremento de domínio implementado e validado localmente. A ação de
produto ainda NÃO está disponível: serviço transacional, API/BFF, interface,
prova PostgreSQL/RLS, UX B/C e CI final permanecem pendentes. PR própria Draft,
base main `5873ff1c`; não inclui a integração P01/P02 da #570 nem FOOD06.

## Decisão do proprietário — 21/11/2026

Resposta explícita: “Sim, seguir essa recomendação” à regra de copiar somente
a versão salva dentro de um rascunho, inserir imediatamente após a original em
operação atômica, exigir salvar alterações pendentes, criar nova identidade e
não herdar chave clínica de comparação nem publicação na biblioteca.

Não amplia autorização a merge, deploy, migrations ou produção. Fonte de
inspiração já pesquisada: SurveyJS, somente padrão de interação, sem código
externo, instalação ou dependência nova.

## Compatibilidade e menor caminho

| Camada | Observado | Decisão |
| --- | --- | --- |
| Domínio | Normalização de configuração existente, sete tipos suportados | Não criar outro normalizador; preparar cópia independente dos valores salvos |
| Serviço | adicionarPergunta e reordenarPerguntas são operações separadas | Não encadear POST+PATCH no navegador; atomicidade precisa de comando backend |
| Versão | Pergunta não tem revisão própria; Questionario tem versao; reordenação atual não incrementa essa versão | Não tratar somente número como prova completa de identidade/revisão da origem |
| Concorrência | Escritores atuais não compartilham trava editorial explícita | Mapear todos os escritores relevantes e ordem de locks antes de integrar |
| UI | criar/salvar pergunta persistem diretamente; existe proteção de alterações pendentes | Copiar apenas origem salva, bloquear enquanto salva ou tem pendências; explicar bloqueio |
| Histórico | Envios/versões usam infraestrutura existente | Nenhuma alteração retroativa; comprovar em testes de integração |

## T01 — domínio puro (incremento atual)

Código testado: `fbb04005abeb4597d8472927f74e5a9872dfd95a` (última mudança
após os gates foi somente terminologia de comentário, sem comportamento).

- `copiarDefinicaoPergunta` projeta somente campos reutilizáveis, exclui IDs,
  tenant, vínculo do questionário, chave clínica e ordem da pergunta; fixa
  visivelBiblioteca=false. Configuração congelada é clonada sem renormalização;
  rótulos, valores, imagens e ordem das opções são preservados sem seus IDs.
- `planejarInsercaoCopiaPergunta` recebe lista autoritativamente ordenada,
  rejeita origem inexistente, IDs repetidos/conflitantes e identidade vazia,
  planeja inserção adjacente e numeração sem mutar a lista recebida.
- Estas funções NÃO autorizam acesso, geram UUIDs, leem snapshots, persistem
  cópias ou comprovam atomicidade. Configuração é dado salvo recebido do serviço,
  não DTO arbitrário nem nova projeção HTTP; validação e limites do comando
  serão obrigatórios na integração. Não transportar payload cru para respostas.
- Reutiliza tipos ORM apenas via import type; configuração por tipo permanece
  no contrato existente. Sem migration nem mudança de motor clínico.

### TDD e verificações

| Gate | Estado/evidência |
| --- | --- |
| RED | Jest compilou e executou: 15 falhas pela ausência dos contratos de cópia/inserção, sem erro de setup. Seis negativas inicialmente capturavam qualquer exceção e NÃO contam como prova; foram corrigidas para exigir BadRequestException |
| GREEN final | 68/68: 21 novos domínio, 3 configuração existente, 44 serviço questionários |
| Oráculos | Sequências literais nas três posições; sete configurações válidas pelo normalizador existente; independência de referências; zero/falso e legado; nenhuma identidade/chave clínica no resultado |
| Typecheck | PASS — Node22.21.1, tsc --noEmit backend |
| Build | PASS — Nest build + verificar-artefato-producao.mjs, dist/main.js |
| Segurança local | Scanner de segredos e diff-check PASS antes do commit |
| Revisão independente | Favorável estática, /root/auth2_r4; leu arquivos reais, não executou testes próprios. Observações sobre oráculos/configurações incorporadas |
| UX A | [Parecer profissional](../docs/agents/ux/reports/QST-P05-A-2026-11-21/avaliacao.md); paciente N/A |
| PostgreSQL/RLS e rollback | NOT RUN: nenhum caminho persistente integrado neste incremento; obrigatório antes do aceite da operação |
| Playwright/UX B/C | NOT RUN: interface ainda não implementada |
| CI/scanners remotos | Pendente no HEAD enviado; instalação local reutilizada, CI canônico necessário |

Uma tentativa de execução com caminho relativo errado não criou arquivos e
não é evidência RED. A primeira tentativa GREEN encontrou erro de tipagem no
adaptador de testes; não conta como GREEN. O resultado acima é da suíte final
corrigida, sem casts para ignorar erro no código de produção.

## Próximos incrementos — mesma PR, sem nova autorização por etapa técnica

1. **T02 — serviço e contrato transacional.** Resolver tenant/ator no servidor,
   autorizar mesmo rascunho, fixar origem salva/revisão exata e lista ordenada;
   gerar novas identidades no servidor. Persistir cópia, opções, ordem e versão
   num único ExecutorTenant. Definir CAS/locks com os escritores atuais e
   comportamento de repetição sem cópia duplicada. Não inventar ledger ou nova
   migration por conveniência. Testar falhas intermediárias e rollback real.
2. **T03 — controlador/BFF.** DTO limitado, UUIDs validados, permissão existente
   questionarios.gerenciar; reautorização no serviço, auditoria mínima e resposta
   por allowlist. Testar tenant/profissional errados, revogação, origem alterada,
   rascunho publicado entre leitura/confirmação e payload manipulado.
3. **T04 — editor.** Ação nas propriedades, motivo dos bloqueios visível mesmo
   com botão desabilitado. Em sucesso selecionar cópia e focar enunciado; em
   falha preservar origem/seleção/edições. Sem copiar da memória não salva ou
   publicar automaticamente; sem ativação parcial antes de T02/T03.
4. **T05 — aceite.** PostgreSQL descartável/role runtime/RLS, concorrência e
   retries; regressões das versões/envios; desktop/mobile, teclado e fonte200,
   UX B/C, revisão independente da operação completa e CI do SHA final.

## Critérios de produto

| ID | Critério | Estado atual |
| --- | --- | --- |
| P05-C1 | Origem salva no mesmo rascunho autorizado | PENDENTE serviço/UI |
| P05-C2 | Cópia independente com novos IDs de pergunta/opções | PARCIAL: campos/independência testados; geração dos IDs pendente |
| P05-C3 | Sem herdar chave clínica/biblioteca | PARCIAL: domínio PASS; persistência/HTTP pendentes |
| P05-C4 | Inserção adjacente e atômica | PARCIAL: plano em memória PASS; transação/locks/CAS pendentes |
| P05-C5 | Repetição, rollback e alteração concorrente seguros | PENDENTE |
| P05-C6 | Pendências bloqueiam; foco/seleção e erros claros | PENDENTE UI/UX B/C |
| P05-C7 | Snapshots/envios antigos intactos | PENDENTE prova integrada; não foram alterados arquivos desse fluxo |

Não declarar P05 pronta para merge com essa matriz parcial. Nenhuma alteração
na FOOD06, branches alheias, main local, banco externo ou infraestrutura.
