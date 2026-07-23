# Fase 121 - Rate limiting, lockout e protecoes anti-abuso

Data: 2026-07-23

## Objetivo

Reduzir abuso em rotas sensiveis do OctaClin antes de producao, especialmente login, recuperacao de senha e convites administrativos.

## Entregas

- Criado `ServicoProtecaoAbuso` com contadores em memoria por chave e politica configuravel.
- Login passa a bloquear tentativas abusivas antes de consultar tenant/credenciais.
- Login registra falhas apenas quando tenant, usuario ou senha forem invalidos.
- Login limpa o contador quando a autenticacao for bem sucedida.
- Recuperacao de senha passa a limitar solicitacoes antes de consultar tenant/usuario, preservando resposta generica contra enumeracao.
- Convites administrativos passam a limitar criacao e reenvio repetidos.
- `GuardaLimiteLogin` foi simplificado para consultar bloqueios vigentes, deixando o registro de falha no servico de auth.
- `ModuloAuth` exporta o servico anti-abuso para uso por outros modulos sensiveis.

## Politicas iniciais

- Login: 5 falhas em 15 minutos, bloqueio por 15 minutos.
- Recuperacao de senha: 3 solicitacoes em 15 minutos, bloqueio por 30 minutos.
- Convites administrativos: 10 acoes em 15 minutos, bloqueio por 30 minutos.

## Decisoes

- A implementacao atual e em memoria para manter baixo custo e sem nova dependencia nesta fase.
- Em producao multi-instancia, a mesma interface deve ser migrada para Redis/Upstash para compartilhar bloqueios entre replicas.
- As chaves usam escopo, tenant e email ou usuario alvo; nao armazenam senha, token, corpo de mensagem ou dado clinico.
- O bloqueio usa HTTP 429 com mensagens genericas e nao revela se email, tenant ou usuario existem.

## Arquivos principais

- `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.spec.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-auth.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-auth.spec.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-recuperacao-senha.ts`
- `octaclin-backend/src/modulos/auth/aplicacao/servico-recuperacao-senha.spec.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/servico-usuarios-cliente.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
cd octaclin-backend
.\node_modules\.bin\jest.cmd --runInBand src/modulos/auth/aplicacao/servico-protecao-abuso.spec.ts src/modulos/auth/aplicacao/servico-auth.spec.ts src/modulos/auth/aplicacao/servico-recuperacao-senha.spec.ts src/modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts
```

## Pendencias para fases futuras

- Migrar armazenamento dos contadores para Redis/Upstash antes de producao multi-replica.
- Adicionar throttling por IP/rede e rota para APIs de maior volume depois da revisao multi-tenant.
- Avaliar alertas quando uma chave atingir bloqueio com frequencia anormal.
