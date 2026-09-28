# Fase 288 — revisão de respostas de formulário

## Base e objetivo

O item 5 da seção 15 da auditoria de produto pede sinalizar a revisão de respostas de formulário após a tarefa de revisão de perfil da Fase 287. A notificação in-app e o webhook de formulário respondido já existem; o dashboard também lista uma amostra de pendências, porém permite marcar um envio como revisado sem mostrar a resposta. Esta fase entrega uma fila completa e um fluxo de leitura individual, com síntese factual das perguntas e respostas, sem IA nem interpretação clínica.

## Modelo, skills e risco

- Modelo: Sol, esforço alto, conforme matriz local de handoff.
- Skills usadas no planejamento e na entrega: `agent-skills:planning-and-task-breakdown`, `nestjs-best-practices`, `typeorm`, `security-review`, `vercel-react-best-practices`, `fechar-fase` e `test-driven-development`.
- Risco R4: respostas contêm dados clínicos; acesso, tenant, RLS e auditoria são propriedades críticas. Não há migration nem operação de produção nesta fase.

## Contrato funcional

1. O dashboard mantém o indicador e mostra somente uma prévia da fila; seu botão abre a resposta individual. Uma página própria lista todos os envios respondidos sem revisão, com paginação, ordem determinística e total.
2. O detalhe consulta apenas um envio, seu paciente e sua resposta finalizada. Exibe título do formulário, paciente, datas e próxima consulta do paciente quando existir, sem afirmar vínculo causal com o formulário. `agendamentoId` do envio refere-se ao agendamento do questionário, não à agenda clínica. Perguntas/valores seguem a ordem do snapshot enviado. Valores são apresentados como dados informados, sem escore ou conclusão inferida. Opções de múltipla escolha usam seus rótulos históricos; anexos mostram apenas a contagem. Caso o snapshot não exista, usa a definição atual apenas para rotular as perguntas encontradas e informa a limitação.
3. A API emite um comprovante de leitura curto, vinculado a tenant, usuário e envio, somente após autorizar e carregar o detalhe. As duas rotas antigas de revisão exigem esse comprovante. A interface solicita confirmação explícita depois de exibir a resposta. Comprovante fica só em memória da página, sem URL, cache persistente, logs ou telemetria.
4. A conclusão atualiza `revisadoEm` e `revisadoPorUsuarioId` de forma idempotente e transacional. Concorrência entre profissionais não sobrescreve a primeira revisão. Uma segunda tentativa mostra estado já revisado. A auditoria registra abertura e conclusão com identificadores opacos, sem payload clínico.
5. Profissional só lê/revisa paciente sob sua responsabilidade atual; SuperAdmin respeita o mesmo tenant. Mudança de responsável entre leitura e confirmação é revalidada. Envio de outro tenant, não respondido ou sem resposta finalizada não expõe dados. Acesso clínico permanece autorizado no servidor, sem confiar em tenant fornecido pelo cliente.
6. A fila e o detalhe têm estados de carregamento, vazio, erro e conclusão, navegação por teclado e layout responsivo. Sem novos tipos de documento ou automação de decisão clínica.

## Implementação e aceite

1. Criar testes de serviço para paginação, isolamento por tenant/paciente, snapshot histórico, comprovante inválido/expirado/de outro usuário, mudança de responsável e revisão concorrente/idempotente. Criar testes de contrato das rotas e do fluxo web.
2. Implementar consulta paginada e detalhe mínimo no backend dentro de `ExecutorTenant`, com filtros por tenant e autorização atual do paciente. Não enviar entidade ORM crua nem respostas de outros envios.
3. Exigir comprovante nas duas rotas de revisão existentes e manter auditoria sem payload clínico.
4. Implementar BFF e tela de revisão; trocar a ação cega do dashboard por navegação para o detalhe, com entrada para a fila completa.
5. Reconciliar checklist, status e auditoria com o merge já confirmado da Fase 287 e o estado real desta fase. Registrar backfill 287 como procedimento externo ainda pendente sem evidência de execução.
6. Rodar testes focados e gates aplicáveis, `git diff --check` e `pnpm security:secrets`; revisar diff e abrir um único PR.

## Revisão crítica do plano

- A fila do dashboard é limitada a 50: a página paginada evita perder pendências antigas.
- A leitura agregada por questionário não limita exposição ao envio: o detalhe novo consulta apenas o envio escolhido e seu paciente atual.
- O botão antigo e sua rota paralela contornariam a leitura: ambos passam pelo mesmo comprovante obrigatório no backend.
- Um comprovante apenas na interface não estabelece vínculo com a resposta lida: ele é assinado, expira e é validado no servidor para tenant, usuário e envio. Isso prova a abertura autorizada da resposta, não a atenção humana; a confirmação explícita fecha o fluxo de produto.
- As respostas podem ter sido enviadas sob versões antigas: o snapshot do envio é fonte primária para rótulos e ordem.
- Responsável, sessão ou estado podem mudar depois da abertura: a autorização e o estado são relidos dentro da transação de revisão.
- A notificação existente já cobre a chegada da resposta: não criar uma segunda notificação ou webhook.
- Não existe evidência de execução externa do backfill 287: manter pendente até comprovação.

## Rollback e limites

Rollback de código deve manter a conclusão cega desabilitada enquanto a política de leitura permanecer aprovada; o estado `revisadoEm` existente permanece. Não há DDL. A fila não classifica urgência clínica e não substitui avaliação profissional. Aceite de produção requer evidência própria de deploy e de operação externa.

## Evidência local antes do PR

- PASS: TypeScript de backend e web, build Nest e build Next.js com Node 22.
- PASS: 56 testes focados do backend, incluindo revisão, autorização e contrato existente.
- PASS: contratos BFF de revisão e dashboard (5 e 5 casos), checagem de linguagem, lint dos arquivos web alterados, `git diff --check` e scanner local de secrets.
- NA: migration e backfill nesta fase. O backfill da Fase 287 continua procedimento externo pendente de evidência.
- SKIPPED: validação mutável em staging/produção, por não integrar o escopo deste PR. CI do PR e revisão cruzada serão registrados após abertura.
