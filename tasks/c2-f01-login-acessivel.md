# C2-F01 — login acessível e mensagens públicas

Base `0fd46a01`, branch `feat/c2-f01-login-acessivel`, Node 22.21.1.
Risco R4 por interface de autenticação. Dados e contas dos testes são sintéticos.

## Diagnóstico e implementação

CampoSenha já possuía Caps Lock. A lacuna era compor a descrição externa com o
aviso, em vez de sobrescrevê-la. Login exibia mensagens arbitrárias do servidor,
não focava falhas e aceitava dois submits no mesmo evento antes do próximo render.
Uma falha na preparação do MFA deixava uma etapa de configuração sem chave.

- Mensagens públicas escolhidas por status, sem interpretar a mensagem recebida.
  400/401/403 não distinguem conta inexistente de senha incorreta; 429 orienta
  aguardar sem inventar prazo; rede e 5xx têm recuperação genérica.
- Erro recebe foco após falha, não durante digitação. Associação ARIA preserva
  Caps Lock e erro. Falhas iguais consecutivas também recebem foco.
- Trava síncrona evita requests duplicados durante envio. `aria-busy` e botão
  indicam espera. Guard após cada await ignora resposta de tela desmontada.
- MFA só muda para configuração depois de obter a chave. Senha continua limpa
  após desafio, sem trim/normalização novos. Código mantém normalização atual.
- `ErroApiAutenticacao` adiciona status, preserva Error e mensagens dos demais
  consumidores. BFF, autorização, cookies e redirecionamento seguro preservados.

Não há novo armazenamento, log, analytics, banco, pacote, permissão ou política
de autenticação. Guard de interface não cancela nem revoga uma sessão no servidor.
Rollback de código reverte esta interface, sem migração de dados persistidos.

## RED/GREEN e verificações

Testes em `octaclin-web/tests/visual/auth-experiencia-login.spec.mjs`; regressão
existente `mfa-login.spec.mjs`. Execuções em Chromium desktop e Pixel 5 emulado,
servidor Next real da worktree, respostas HTTP sintéticas interceptadas.

| Execução | Resultado observado | Limite |
| --- | --- | --- |
| RED inicial | Seletor de alert ambíguo com announcer do Next | Corrigido no teste; não usado como RED funcional |
| RED corrigido, desktop, antes da implementação | 6 FAIL funcionais + 1 PASS legado | Mensagem, duplicidade, recuperação de MFA e foco reproduzidos |
| GREEN login inicial + MFA legado | 18/18 PASS | 7 casos novos + 2 existentes, dois projetos |
| Rede, redirect e resposta tardia | 8/8 PASS | Inclui repetição de um caso inicial; não somar como casos exclusivos |
| Teclado e texto a 200% | 2/2 PASS | Ampliação por tamanho de fonte, não teste de zoom nativo nem leitor de tela |
| Retry após falha de configuração MFA | 2/2 PASS | Agora também tenta novamente com sucesso até a tela de configuração |
| Typecheck Web | PASS | Node 22; não é build |
| ESLint dos arquivos funcionais e teste novo | PASS | Não é lint global |
| Linguagem da interface | PASS | Gate existente |
| Secrets e diff-check | PASS no checkpoint local | Repetir sobre staged antes de push |

Asserções cobrem conteúdo e foco reais, senha enviada sem trim, campos/autocomplete,
estado de espera, contagem de requests, ARIA, axe, navegação e ausência de overflow.
Não há exposição de dados reais. Não alegar prova de RLS/cookies por browser mocks.

### Regressão ampla e ajuste de teste existente

A suite `acessibilidade.spec.mjs` inteira contém 276 casos desktop/mobile.
Foi interrompida para restringir à superfície afetada, sem declarar PASS global:
33 PASS, 2 resultados FAIL e 241 NOT RUN na rodada interrompida. Um FAIL é seletor
antigo ambíguo do título Pacientes (também encontra Lista de pacientes, componente
inalterado da base). Correção mínima: `exact: true`; mesma asserção, 2/2 GREEN.
O outro caso, navegação ao detalhe, foi afetado pela interrupção e passou em
execução isolada desktop/mobile (2/2). Traces interrompidos não são evidência íntegra.

Regressão focada das rotas de acesso: 26/26 PASS desktop/mobile. CI final:
pendente de envio. Suíte global permanece incompleta. Nenhuma falha foi mascarada com retry,
timeout maior, remoção de assert ou alteração de segurança.

## Revisões e critérios

R4 independente estática: `/root/c2_f01_r4`, sem edição, rede ou testes próprios,
nenhum risco reproduzível identificado. Patch funcional revisado (git diff dos
três arquivos de código, base acima), SHA-256:
`498cf880e550ff8e9a033397cfeec2805efc9a4443dc19b9c76abafbf0a75c2b`.
Limites: ausência de execução própria, cookie/backend real e leitor de tela manual;
casos HTTP 400/403, corpo HTML/malformado e desmontagem durante MFA não foram
executados individualmente. Retry MFA foi ampliado após o parecer, sem mudar código.

UX A preservada em `docs/agents/ux/reports/C2-F01-F02-A-2026-11-25`.
B/C têm relatório próprio; avaliações simuladas não aprovam segurança nem usuários
reais. Não há nova decisão de produto necessária nem expansão para F02.

| Critério | Implementação | Validação |
| --- | --- | --- |
| F01-C1 | Caps Lock existente reutilizado; descrições compostas | GREEN browser + axe desktop/mobile |
| F01-C2 | Foco, erro seguro, espera e trava síncrona | RED/GREEN; rede/limite/erro repetido/late response |
| F01-C3 | Login/MFA/autocomplete/redirect preservados | Regressoes focadas e R4 estática; CI pendente até HEAD enviado |

## Reproduzir

Em `octaclin-web`, Node 22 e dependências suportadas, iniciar Next em porta livre.
Sem usar backend real, definir `E2E_WEB_URL` local e
`E2E_REUSE_EXISTING_SERVER=true` e executar:

```sh
node node_modules/@playwright/test/cli.js test tests/visual/auth-experiencia-login.spec.mjs tests/visual/mfa-login.spec.mjs --reporter=list
node node_modules/@playwright/test/cli.js test tests/visual/acessibilidade.spec.mjs --grep 'acesso publico|rotas criticas.*login' --reporter=list
node node_modules/typescript/bin/tsc --noEmit
```

CI Demo local smoke já executa `pnpm smoke:visual` (descoberta de todos os specs);
o novo arquivo participa automaticamente, sem mudança de workflow/package script.
Build e CI globais locais: SKIPPED; limite de disco e proporcionalidade. Gates
oficiais do HEAD enviado continuam obrigatórios. Não há merge/deploy/operação externa.

## Próxima fase

F02: feedback real de clipboard em login/conta, em PR própria, com referência
explícita à base F01 se empilhada. Não misturar com consolidação #585–#592 ou FOOD06.

## Checkpoint de entrega local

- Código: `6c2e9a44`; correção mínima do seletor legado: `c5adf9ba`.
- Nenhuma alteração funcional após os testes e a revisão R4 descritos acima.
- ESLint final inclui também `acessibilidade.spec.mjs`: PASS.
- Typecheck Node 22 após encerramento do Next e restauração somente dos dois
  arquivos derivados (`AGENTS.md` gerenciado/`next-env.d.ts`): PASS.
- Acesso 26/26, seletor legado 2/2 e navegação 2/2 confirmados. B/C das duas
  personas concluídas, sem novo bloqueio de UX no escopo automatizado.
- Leitor de tela manual NOT RUN; build local SKIPPED por disco; CI NOT RUN até
  push. Não há PASS global da rodada interrompida. PR continuará Draft.
