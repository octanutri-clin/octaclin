# Fase 285 - PB-20: comparação fotográfica manual

## Evidência e escopo

O PR #320 integrou PB-22 em `main` em 2026-09-27. A auditoria de produto
mantém PB-20 pendente: a tela lista séries e abre uma imagem por vez. O contrato
da Fase 236 já define protocolo cifrado, consentimento versionado, arquivo
privado e comparação por escolha manual. Esta fase usa esses contratos, sem
migration, novo provedor ou publicação no portal do paciente.

Modelo: GPT-6 Sol, esforço alto. Skills: `planning-and-task-breakdown`,
`vercel-react-best-practices`, `security-review` e `fechar-fase` no fechamento.

## Entrega planejada

1. Mostrar ao profissional uma comparação de duas séries do mesmo protocolo,
   com data e protocolo legíveis, seleção manual, layout responsivo e estados
   vazios/erro. Nenhum diagnóstico, pontuação ou interpretação automática.
2. Pedir as URLs assinadas somente quando o usuário iniciar a comparação.
   Manter as URLs apenas em memória durante a visualização, expirar a prévia
   com o prazo retornado pelo backend e não gravar foto ou URL em Cache Storage,
   localStorage, logs, telemetria ou documento.
3. Reforçar a fronteira no backend: apenas Professional da própria carteira e
   SuperAdmin do tenant acessam séries, consentimentos e foto clínica. O
   endpoint de mídia deve identificar vínculo fotográfico e negar Patient,
   série excluída e prazo de retenção vencido antes de assinar a URL. A
   revogação bloqueia novas capturas; histórico ainda dentro do prazo segue
   disponível ao profissional, como definido na Fase 236.
4. Reconciliar PR #320 e PB-22 nos documentos canônicos; registrar PB-20 como
   implementado nesta branch e pendente de checks/merge.

## Risco, rollback e limites

R4 por PHI, autorização e storage clínico. Não há mudança de schema nem ação
em staging/produção. Reverter o PR remove a comparação e as restrições novas;
qualquer relaxamento de acesso exigiria nova decisão de segurança. As URLs
emitidas antes do rollback ou da revogação continuam válidas até expirar por
contrato do storage (até cinco minutos); não há revogação retroativa da URL.
Expurgo físico automático após o prazo não faz parte do PB-20 e deve seguir o
procedimento de retenção aplicável.

## Gates previstos

- Revisão de diff e segurança com foco em role, tenant, carteira, consentimento,
  prazo de retenção e ausência de persistência de imagem/URL.
- Typecheck e build dos pacotes alterados; `git diff --check`, preflight
  documental e scanner de secrets.
- Checks do PR em Node 22 e gates de integração reais após abrir o PR.

## Implementação nesta branch

- `ComparacaoEvolucaoFotografica` agrupa séries confirmadas por protocolo
  normalizado, exige duas datas diferentes e obtém uma URL assinada por foto
  apenas após ação do usuário. A prévia expira antes da URL e não persiste no
  cliente; a tela restringe a aba a quem tem papel e permissão clínica.
- Os controladores e serviços de foto e consentimento aceitam somente
  Professional e SuperAdmin. O serviço de mídia valida o vínculo clínico,
  paciente, série não excluída e prazo do consentimento antes de assinar o
  download. A listagem de mídia do Patient omite fotos clínicas vinculadas;
  para a equipe, omite também séries excluídas ou fora do prazo. A confirmação
  genérica e a do formulário público não retornam metadados de foto clínica
  a quem não tem acesso; o vínculo esperado do formulário é validado antes
  do retorno idempotente.
- A listagem de séries não retorna séries cujo consentimento ultrapassou o
  prazo. A resposta BFF que contém a URL assinada usa `Cache-Control: no-store`.
  O download assinado solicita `Cache-Control: private, no-store, max-age=0`
  no cabeçalho dos bytes por parâmetro assinado `response-cache-control`.
- Revogação continua impedindo novas capturas; séries históricas ainda dentro
  do prazo permanecem visíveis a profissional autorizado, conforme a decisão
  registrada na Fase 236.

## Estado de integração

Implementado em branch dedicada. A revisão cruzada estática identificou três
lacunas: confirmação genérica, listagem genérica após retenção e cache HTTP dos
bytes. As três foram corrigidas nesta branch. Uma segunda revisão cruzada,
somente leitura e sem testes, confirmou estaticamente os três fechamentos e
não encontrou novo bypass na confirmação pública/idempotente. O contrato S3 e a documentação da Backblaze
suportam `response-cache-control`, mas o cabeçalho real do provedor não foi
verificado neste ciclo. Essa verificação permanece gate do ambiente aplicável.

Gates locais: typecheck web e backend PASS; build backend PASS; preflight
documental e scanner de secrets PASS; ESLint dos componentes web alterados
terminou com 0 erros e 7 avisos de `react-hooks/set-state-in-effect` em
arquivos existentes. Build web FAIL por `ECONNRESET` durante `next/font` em
`app/layout.tsx`, sem diagnóstico de erro do PB-20. O ambiente local usa
Node 24.19.0, fora do contrato `>=22 <23`; CI em Node 22 ainda pendente.
Testes unitários e E2E SKIPPED neste ciclo, conforme limite da solicitação;
checks do GitHub ainda pendentes. Não há evidência de deploy nem de alteração
de ambiente externo.
