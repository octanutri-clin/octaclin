# C2-F03 — recuperação de senha

Branch `feat/c2-f03-recuperacao-senha`, base main `0fd46a01`; worktree própria.
Plano aprovado por referência explícita: `cb39c2c5`,
[planejamento do ciclo](https://github.com/octanutri-clin/octaclin/blob/cb39c2c5deded42f24aa9d114075a2d0462aef4a/tasks/plan-ciclo2-login-cadastro-formularios-operacao.md), seção C2-F03, na #594.
Não integrar implicitamente F01/F02 ou a cadeia #585–#592. Claude/FOOD06 intactos.
Risco R4 (interface auth). Sem merge, deploy, migration ou operação externa.

## Auditoria de compatibilidade

| Superfície | Fato no código | Menor incremento |
| --- | --- | --- |
| Serviço de recuperação | Resposta genérica, limite antes da consulta da conta, token de uma hora, consumo/revogação respeitados | Preservar sem mudança de política |
| Serviço de abuso | Limite por contexto/email; nenhum Retry-After retornado | Não inventar prazo/contador no navegador |
| BFF recuperar-senha | Tenant da configuração do servidor; email trim; sem prazo na projeção | Sem mudança de fronteira ou headers |
| recuperacao-senha-api | Classe de erro HTTP já existente e usada pelo classificador | Apenas exportar a classe para escolher mensagem pública |
| EsqueciSenhaForm | Texto arbitrário do servidor, confirmação persiste ao editar, sem trava síncrona/foco | Aviso fixo condicional, orientação, correção/retry explícito, proteção assíncrona |
| RecuperarSenhaForm | HTTP410 engloba expirado/usado/revogado; erro remoto exibido | Texto genérico 410 e falhas públicas, sem mudar validade ou campos legais |

D03 resolvida pela auditoria do contrato existente: novo pedido não revoga todos
os links anteriores; não prometer isso na tela. Reenvio manual usa o mesmo endpoint,
com os mesmos limites. A interface não decide quando o servidor liberou o bloqueio.
Link de diagnóstico retornado sob a política já existente permanece compatível;
nenhuma configuração/flag de exposição foi lida ou alterada, nem produção verificada.

## Plano fechado

1. RED/GREEN da solicitação e mensagens públicas, zero persistência adicional.
2. Orientar conferência do email/spam; corrigir endereço limpa contexto e foca o
   campo; pedido repetido somente por clique, nunca timer ou reenvio automático.
3. Não associar resposta antiga a endereço editado/página desmontada. Trava
   síncrona limita uma solicitação pendente; o servidor permanece autoritativo.
4. Regressões de recuperação/redefinição e primeiro acesso, teste sintético de
   contrato backend, typecheck/lint/linguagem, UX B/C e R4 independente.

Não alterar política de senha, token, consentimentos, revogação de sessões,
autorização, canais ou storage. Rollback de código sem alterar tokens já emitidos.

## UX D/A

Papéis da main, `.codex/agents/`, procedimento obrigatório. Instâncias novas
`/root/c2_f03_nutricionista_ux` e `/root/c2_f03_paciente_ux`, fork sem conversa,
prompt-only, zero ferramentas. A baseada em proposta, sem teste visual próprio.
Critérios recomendados já cobertos pelo escopo autorizado: mensagens condicionais,
limpar confirmação ao editar, uma solicitação pendente e recuperação sem prazo
inventado; HTTP410 neutro. Sem pergunta material bloqueante ou novo produto.
Prioridades diferem: profissional P2; paciente P1 para clareza/espera/correção,
P2 para link indisponível. Preservar diferença, não fabricar consenso.

Checkpoint anterior à implementação: testes/CI NOT RUN. Resultados devem ser
adicionados abaixo, sem transformar planejamento em funcionalidade comprovada.

## Implementação e evidências atuais

Arquivos de produção: EsqueciSenhaForm, RecuperarSenhaForm e exportação da classe
HTTP existente em recuperacao-senha-api. Aviso fixo por tipo de resultado; erro
não lê texto arbitrário do servidor. Corrigir/editar email elimina aviso e link
anteriores; revisão local descarta resposta antiga. Ref síncrona impede dois
submits pendentes, guarda de desmontagem ignora resultado após saída. Sem timer,
reenvio automático ou alteração dos limites/tokens emitidos. HTTP410 recebe título
neutro, mantendo o classificador legado; erros remotos não aparecem na redefinição.
Campos de senha, aceites de primeiro acesso e revogação permanecem iguais.

Pré-requisito reaproveitado explicitamente: cherry-pick de `c5adf9ba` (#593),
somente seletor exato do teste de pacientes, gerando `8ee1ae7b`. Não trouxe F01/F02.
Também foram alinhadas quatro expectativas legadas à mensagem pública/HTTP410
aprovados, sem retirar verificações de payload, autorização, teclado ou consentimento.

| Verificação | Resultado | Limite |
| --- | --- | --- |
| RED inicial | 11 FAIL funcionais + 2 PASS legados | Sintaxe nativa/saída já funcionavam; não forçar RED |
| RED resposta malformada / HTTP400 | 1 FAIL cada | Nenhum erro de setup usado como RED |
| GREEN principal | 28/28 PASS | Desktop/mobile, espera, correção, contexto, retry, privacidade e token |
| Adicionais | 4/4 PASS | HTTP400, teclado e fonte 200% sem overflow |
| Regressões | 36/36 PASS | Acesso público, recuperação, primeiro acesso, payload e seletor legado |
| Contrato backend | 23/23 PASS | Mocks de SMTP/repositórios/Redis; não prova banco ou entrega real |
| Typechecks Web/Backend | PASS, Node 22.21.1 | Não são builds |
| ESLint afetado | PASS, 0 erros / 1 aviso preexistente | set-state-in-effect na linha 73 de RecuperarSenhaForm, também na base |
| Linguagem / diff-check | PASS | Gates existentes, sem alterar severidade |
| R4 independente | Favorável estática | Sem execução própria; detalhe abaixo |
| UX A/B/C/D | Sem bloqueio concreto no escopo relatado | Leitor de tela manual NOT RUN |
| Build local / CI | SKIPPED / pendente até push | Limite de disco; CI oficial do novo HEAD necessário |
| PostgreSQL/RLS local | NA | Nenhuma implementação de leitura/persistência/autorização alterada |

Backend: dois casos adicionados com modo público simulado apenas no processo de
teste (NODE_ENV production e exposição de diagnóstico false), comparando usuário
ativo e usuário ausente no mesmo tenant ativo, com sucesso/falha SMTP. Objetos
serializados são iguais. Não comprova timing, headers, status HTTP, usuário inativo,
RLS ou configuração de produção. A fixture inicialmente comparava tenant ausente;
R4 apontou o alcance limitado, corrigido e reexecutado, confirmado estaticamente.
Nenhum email, banco ou ambiente real foi utilizado.

R4 `/root/c2_f03_r4`, revisor separado, somente leitura, sem achado bloqueante.
Hashes do código revisado e dos relatórios no manifesto UX. Personas em
`docs/agents/ux/reports/C2-F03-ABC-2026-11-25`: análise de proposta/relatos, não
usuários reais. Coordenador viu captura real a 200%; personas não viram imagens.
Sugestão P3 de redação permanece backlog, sem mudança automática de produto.

## Aceite e retomada

| Critério | Estado local | Restante |
| --- | --- | --- |
| F03-C1 — contrato/estados públicos | PASS | CI do HEAD enviado |
| F03-C2 — orientação/correção/retry | PASS | Revisão formal e validação manual assistiva |
| F03-C3 — regressões e privacidade | PASS local + R4 estática + UX | CI/build oficiais; sem declarar proteção de timing/produção |

Sem merge/deploy, sem configuração ou migration externa. CI de outro commit não
aprova este delta. Próxima fase prevista F04, proteção de alterações não salvas no
cadastro por seção/contexto, após auditar e reutilizar o mecanismo existente.
Este documento não executa nem amplia F04.

## Checkpoint de entrega local

Commit funcional `ce858613`; pré-requisito de teste reaproveitado `8ee1ae7b`.
Typechecks finais Web/Backend após encerrar Next PASS; arquivos derivados
AGENTS/next-env restaurados apenas quando correspondiam exatamente à geração
esperada. Secrets staged PASS e diff-check PASS. Nenhuma alteração funcional após
R4/B/C. PR Draft própria para main, independente das #593/#594; não herda seus
checks. CI do HEAD enviado permanece gate antes do aceite, sem merge automático.
