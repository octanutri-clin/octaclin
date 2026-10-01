# Fase 297 — kit inicial para clínicas novas

> Estado reconciliado: integrada em `main` pelo PR #355 (merge `4f51b0ac`,
> confirmado no GitHub). As menções abaixo à branch, revisão e checks pendentes
> registram o momento anterior ao merge. Integração não comprova operação em
> produção; esta reconciliação não consultou o ambiente externo.

## Objetivo e decisões

Completar o onboarding do PB-29 com conteúdo inicial útil para uma clínica recém-provisionada. O proprietário definiu instalação automática **somente em clínicas novas**. O kit inclui estruturas editáveis de refeições e materiais genéricos; não inclui carga de catálogo de alimentos, quantidades, metas nutricionais nem prescrição pronta. Nenhum material é enviado automaticamente ao paciente.

Modelo de trabalho: Sol, esforço alto. Skills usadas: `agent-skills:planning-and-task-breakdown`, `test-driven-development` e `security-review`, além das regras locais do repositório.

O trabalho permanece na branch `feat/fase297-kit-inicial-clinica`. O proprietário confirmou o merge da Fase 296 e a aplicação da migration 1059; o PR #353 consta como mergeado no GitHub (`ccd1c0bb`). O ambiente da aplicação não foi identificado nesta confirmação nem verificado diretamente nesta fase.

## Diagnóstico do código e limites

- O provisionamento assistido cria tenant, configuração, Client e templates de comunicação na mesma transação. O contexto RLS do novo tenant é definido antes das escritas dependentes.
- O modelo de plano persistido exige pelo menos um alimento (`total_itens > 0` no banco e DTO de rascunho). A estrutura genérica, sem alimento, deve permanecer como catálogo de código exibido no editor. Ao selecionar, substitui as refeições do rascunho; o profissional adiciona alimentos, quantidades e demais dados antes de salvar como modelo ou plano.
- Materiais enviados referenciam o registro da biblioteca. A adaptação de um material inicial deve criar **uma cópia** pela interface existente; editar o registro original poderia alterar retroativamente o que o paciente vê.
- O catálogo TACO já tem artefato e procedimento de carga governado, mas a carga por ambiente depende de confirmação de origem/direito de uso e aprovação operacional. Esta fase não executa carga nem inventa composição.

## Entrega vertical

1. **Conteúdo versionado**: definir poucas estruturas de refeições sem itens e materiais de uso do produto, com textos factuais e limites de tamanho. Evitar horários, alimentos, nutrientes, metas e orientações clínicas para perfis específicos.
2. **Provisionamento**: dentro da transação de criação de tenant, depois do usuário Client existir e sob contexto RLS, gravar materiais ativos, sem envios, e marcador da versão do kit em `tenant_configuracoes`. Reuso de referência/slug retorna o tenant existente sem reinstalar nem sobrescrever conteúdo. Falha em qualquer gravação aborta toda a criação.
3. **Leitura clínica segura**: a listagem de modelos expõe as estruturas iniciais apenas para tenant com marcador do kit, mantendo as mesmas guardas de papel/permissão e o escopo do tenant. Estruturas de código não contam como modelos pessoais ou clínicos persistidos.
4. **Interface**: no editor de plano, mostrar estruturas separadas dos modelos salvos, com aviso de que faltam alimentos e revisão profissional; nunca oferecer publicação direta. Na biblioteca existente do prontuário, permitir copiar um material para o formulário de criação, editar e salvar como novo registro; envios anteriores continuam apontando ao original. O guia de onboarding explica onde personalizar o kit sem declarar a etapa de modelo pessoal concluída pela mera presença das estruturas.
5. **Fechamento**: testes focados positivos/negativos de provisionamento, tenant, autorização, reuso, estrutura incompleta e cópia; typecheck/build, gates de linguagem, authz, scanner de segredos e `git diff --check`. Reconciliar auditoria, checklist e status no mesmo PR quando o merge anterior ocorrer.

## Revisão de gaps do plano

| Gap | Decisão |
| --- | --- |
| Modelo genérico inválido no banco | Estrutura de código sem alimento; modelo persistido só após preenchimento. Sem migration nova. |
| Prescrição implícita por item fictício | Nenhum alimento, dose ou nutriente de exemplo. O backend mantém validação de pelo menos um alimento. |
| Tenant antigo recebe dados novos | Instalador roda somente no ramo de criação; leitura das estruturas depende do marcador no tenant. |
| Repetição ou concorrência de provisionamento | Reusar referência/slug e a transação existente; nenhuma reinstalação no ramo reutilizado. |
| Novo tenant criado parcialmente | Materiais e marcador integram a transação do tenant e do convite; falha gera rollback. |
| Alteração de material já enviado | Personalização cria cópia, sem mutação do original. |
| Envio involuntário | Instalador não cria envio, outbox ou notificação. Profissional escolhe paciente e envio depois. |
| Vazamento entre clínicas | Tenant sempre vem da credencial ou da criação interna; RLS e consultas filtram tenant. Testes negativos cobrem outro tenant. |
| Marca de conclusão indevida no guia | Estruturas não entram na contagem de modelos pessoais; somente dados realmente persistidos concluem a etapa. |
| Dependência de catálogo não carregado | Estruturas não referenciam UUIDs de alimentos. Carga TACO fica fora do PR. |
| Material inicial sai da lista após muitos itens | O kit é ponto de partida para clínica nova; revisar paginação da biblioteca se a lista atingir o limite de 200, sem alterar a API nesta fase. |

## Risco e rollback

R4 pelo provisionamento e isolamento de tenant. Não há DDL. Rollback de código interrompe instalação em novos tenants; registros já criados devem ser preservados ou removidos apenas por procedimento autorizado, jamais por limpeza automática. Revisão cruzada de tenant/RLS e do conteúdo é necessária antes do merge. CI e ambiente de teste não provam produção. Nenhuma ação de produção, migration ou catálogo é executada nesta fase.

## Evidência local e pendências de integração

- `PASS` — testes focados do provisionamento e da listagem de modelos: 31 testes, incluindo autorização negativa, marcador de outro tenant e reuso do provisionamento.
- `PASS` — suíte completa NestJS após integrar `main`: 242 suítes e 2.245 testes aprovados. Quatro suítes e 41 testes foram `SKIPPED` pela configuração da própria suíte.
- `PASS` — Playwright desktop e mobile: aplicar estrutura sem alimentos bloqueia salvar modelo; copiar material gera novo registro sem alterar o original.
- `PASS` — `typecheck` e build de backend e Web, gate de linguagem e scanner local de segredos.
- `PASS` — preflight documental e Playwright desktop/mobile executados novamente sobre a `main` integrada (quatro cenários focados aprovados).
- `PASS` — ESLint dos arquivos Web tocados, sem erros; seis avisos de hooks em fluxos existentes.
- `SKIPPED` — prova PostgreSQL/RLS real: não há banco descartável confirmado nesta worktree.
- `PENDING` — checks remotos e revisão cruzada R4 dependem do PR.
- O Node local é 24.19.0, enquanto a engine do repositório exige Node 22. A compatibilidade autoritativa depende dos checks em Node 22.
- A reconciliação de `STATUS_ATUAL_PROJETO.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e auditoria do produto integra esta mesma branch. Nenhum estado de produção é inferido destes testes.
