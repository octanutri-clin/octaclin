# C2-F02 — feedback de cópia no MFA

Branch `feat/c2-f02-mfa-copia`, base `f6f3e06b` da PR #593, explicitamente
empilhada sobre `feat/c2-f01-login-acessivel`, não sobre main. Nenhuma integração
automática da cadeia #585–#592. PR própria Draft; sem merge/deploy/migration externa.

## Diagnóstico e contrato aprovado

Quatro botões existentes (chave/códigos, login/conta) chamam clipboard diretamente,
sem esperar confirmação ou oferecer falha recuperável. Não há helper reutilizável
de feedback nesse fluxo. Preservar as operações de MFA e a reautenticação atual;
alterar só o botão e sua apresentação, não tokens, permissões, cookies ou backend.
Risco R4 por interface de segurança. Rollback de código sem migration de dados.

Reutilizar Botao e os fluxos existentes. Sucesso só depois de writeText resolver;
API ausente/negação gera mensagem pública para copiar manualmente o conteúdo já
visível. Nenhuma cópia automática, retry oculto, conteúdo no status/log/storage,
exceção privada na tela ou necessidade de confirmar cópia para continuar o login.
Operação pendente deve manter foco e rejeitar duplicidade. Contexto novo invalida
feedback antigo; resposta tardia não pode anunciar sucesso para outros códigos.

## UX A/D e limites

Reutilizar A das duas personas em
`docs/agents/ux/reports/C2-F01-F02-A-2026-11-25`, NUX-04/05 e PUX-03. A avaliou
F01 e F02 antes da implementação; não alegar nova execução A nesta retomada.
Decisões de F01 B/C consultadas para D: mensagens seguras, foco preservado e
nenhuma inferência de prazo/autoridade do backend. Leitor de tela manual não foi
comprovado pelo axe. F02 permanece independente dos fluxos clínicos do Claude.

## TDD e validação

Testes sintéticos em `octaclin-web/tests/visual/mfa-copia.spec.mjs`, Next real,
clipboard/API de autenticação simulados, sem operar clipboard/dados reais. Casos:
login/conta, chave/códigos, espera/ACK, repetição explícita e duplicidade pendente,
API ausente, permissão negada, teclado/foco, axe e troca de etapa/regeneração.
Ausência de feedback constitui RED funcional; falha de fixture não é RED.

Checkpoint histórico de planejamento, substituído abaixo: RED estava em execução,
sem implementação. Não usar esse checkpoint como estado atual.

## Implementação atual

`components/auth/copiar-conteudo-mfa.tsx` é compartilhado pelos quatro botões:
`components/auth/login-form.tsx` e `components/conta/mfa-conta.tsx`. Reutiliza Botao,
estado de MFA e as operações/reautenticação já existentes. Não houve mudança em
auth-api, rotas, cookies, autorização, formato de chave ou persistência.

- `writeText` aguardado; sucesso somente após resolver. API ausente, rejeição ou
  exceção síncrona recebem mensagem fixa sem conteúdo nem detalhe privado.
- Botão mantém foco com `aria-disabled`, trava síncrona e status associado por ID.
  Continua possível prosseguir no MFA sem aguardar/copiar.
- Contexto opaco por conteúdo/tipo e identidade da operação isolam respostas.
  Symbol não contém chave/códigos; o feedback contém somente estado e contexto.
  Se memo for descartado, feedback anterior deixa de aparecer, sem falso sucesso.
- Guarda de desmontagem impede feedback depois de sair. Não é cancelamento do
  clipboard: uma operação já solicitada ao navegador não pode ser revogada por
  essa interface. Não limpar nem sobrescrever clipboard automaticamente.
- Não foram introduzidos logs, toast com segredo, storage, React key sensível,
  pacote ou migration.

## Evidências executadas

Node 22.21.1, Next real da worktree, Chromium desktop/Pixel 5, fixtures sintéticas.

| Gate | Resultado | Precisão da evidência |
| --- | --- | --- |
| RED inicial | 9/9 FAIL funcionais | Feedback/fallback inexistentes; não setup |
| RED regeneração | 1/1 FAIL funcional | Feedback durante cópia de novo conteúdo inexistente |
| GREEN principal | 28/28 PASS | Login/conta, chave/códigos, ACK, foco, retry explícito, API ausente/negada, axe e invalidação |
| Adicionais | 14/14 PASS | 12 casos novos + 2 repetições para captura; erro síncrono, rejeição tardia e navegação |
| Reforço final | 10/10 PASS | Dois frames após retorno antigo antes das negativas; texto a 200% no login sem overflow |
| Regressões | 44/44 PASS | auth-experiencia-login, mfa-login, sessoes-conta, desktop/mobile |
| Typecheck | PASS | Web, Node 22; não é build |
| ESLint | PASS | Arquivos funcionais e spec afetado, sem novo aviso |
| Linguagem | PASS | Gate existente de interface |
| diff-check/secrets | PASS no checkpoint local | Repetir staged antes do push |
| R4 independente | Favorável estática | Sem execução própria, sem achado reproduzível |
| UX B/C | Sem novo bloqueio comprovado | Duas personas, análise dos relatos e limites abaixo |
| Build local/CI | SKIPPED/pendente | Disco local limitado; CI do novo HEAD ainda necessário |
| Backend/PostgreSQL/RLS local | NA | Nenhuma fronteira servidor/persistência alterada; browser mocks não provam isolamento |
| Leitor de tela e seleção por toque | NOT RUN | Não deduzir pelo axe, foco, screenshot ou seleção programática |

As contagens de execuções incluem sobreposição: não somar como casos exclusivos.
O spec final define 20 cenários × 2 projetos; executados em grupos acima. Prints
recortam botão/status e não incluem chaves/códigos. Arquivos de execução em /tmp
são auxiliares; este registro e os testes versionados permitem retomada.

## Revisão e UX

R4 `/root/c2_f01_r4` revisor separado, somente leitura, não implementou F02. Examinou
o componente, as duas integrações e os testes. Sem achado reproduzível; limites
iniciais de casos síncrono/desmontagem/rejeição tardia receberam execução adicional
pelo coordenador, não pelo revisor. Código funcional permaneceu inalterado.
Hashes dos arquivos revisados no manifesto UX B/C identificam o artefato, não
atestam execução independente de testes ou disponibilidade em produção.

UX B/C em `docs/agents/ux/reports/C2-F02-BC-2026-11-25`: NUX-04/05 e PUX-03
atendidos no escopo relatado. Coordenador viu recortes reais; personas não viram
imagens nem interagiram. Seleção manual por toque e leitor de tela ficam como
validações pendentes, sem defeito comprovado ou nova funcionalidade automática.

## Matriz e próximo passo

| Critério planejado | Estado recomendado | Pendência |
| --- | --- | --- |
| F02-C1: ACK/falha chave e códigos | PASS local | CI do HEAD enviado |
| F02-C2: acessibilidade e retorno tardio | PASS automatizado local | Verificações manuais NOT RUN |
| F02-C3: regressões e revisão | PASS local/R4 estática/UX | CI/build oficiais e revisão formal |

C1/C2 foram implementados juntos porque o componente único resolve os quatro
botões sem uma etapa intermediária insegura. Commit funcional/testes e commit
documental separados; não fabricar RED ou commits artificiais para simular fases.
PR Draft própria sobre #593; não pronta para merge até gates. Próxima fase F03:
auditar recuperação de senha e limites reais antes de ajustar retry/orientação,
sem inventar prazo nem expor existência da conta. Não iniciar outra decisão de
produto automaticamente.

## Checkpoint de entrega

Commit funcional/testes `cee90eb0`. Typecheck Node 22 e lint finais PASS após
encerrar Next; secrets e diff-check staged PASS. Código funcional sem alteração
após R4/B/C; hashes no manifesto. Restauração restrita dos arquivos derivados
AGENTS/next-env, sem alterar instruções versionadas. CI será consultado no HEAD
enviado, não herda PASS da #593; a base ainda tinha smoke em execução na última
consulta. Não declarar prontidão para merge. Nenhuma escrita em main ou ambiente externo.
