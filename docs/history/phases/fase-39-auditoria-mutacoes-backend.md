# Fase 39 - Auditoria de mutacoes backend

## Objetivo

Ampliar a trilha de auditoria do OctaClin para registrar mutacoes administrativas e operacionais relevantes, mantendo dados sensiveis fora dos metadados de auditoria.

## Entregas

- Pacientes e Profissionais agora auditam criacao, atualizacao e arquivamento.
- Questionarios auditam criacao de categoria, criacao/atualizacao de questionario, criacao/atualizacao/reordenacao de perguntas e criacao de agendamento.
- Comunicacoes auditam criacao de canal, criacao de template e disparo de mensagem.
- Automacoes auditam criacao de regra e solicitacao de avaliacao.
- IA audita analise de sentimento e reconhecimento alimentar sem persistir texto, imagem ou contexto bruto.
- Mobile audita diario rapido, solicitacao de upload, acompanhante e sincronizacao de lote sem persistir valor livre, PIN, contato ou hash bruto.
- Gamificacao audita circulos, membros, posts, desafios, progresso e badges sem persistir conteudo de comunidade ou regra completa.
- Modulos backend importam `ServicoAuditoria` e `UserActionLogOrm` onde necessario.
- API demo local registra os mesmos eventos para validacao E2E.
- Smoke E2E consulta auditoria das mutacoes principais.
- README registra que a auditoria cobre leituras sensiveis e mutacoes sem payloads brutos.

## Guardrail de dados sensiveis

Metadados de auditoria devem ficar restritos a IDs, tipos, status, flags e contagens. Nao registrar nome, contato, email, texto clinico, conteudo de mensagem, payload mobile, PIN, hash de conteudo, imagem, base64 ou regra completa.

## Validacao

Comandos esperados:

```powershell
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-backend/scripts/api-demo-local.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/typescript/bin/tsc --noEmit
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/next/dist/bin/next build
powershell -ExecutionPolicy Bypass -File outputs/verificar-demo-local.ps1
```

## Proximo passo recomendado

Fase 40 - Filtros e exportacao operacional: melhorar consulta de auditoria/outbox com filtros de recurso, periodo, paginacao consistente e exportacao segura para CSV.
