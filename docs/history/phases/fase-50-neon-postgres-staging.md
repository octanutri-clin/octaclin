# Fase 50 - Integracao Neon PostgreSQL staging

## Objetivo

Criar o primeiro banco PostgreSQL remoto de staging do OctaClin usando Neon e deixar o backend preparado para consumir a connection string padrao da plataforma.

## Decisao tecnica

O backend agora aceita `DATABASE_URL` diretamente. Esse formato e o mais simples para Neon e evita erro manual ao separar host, porta, usuario, senha e nome do banco.

O fallback por variaveis separadas continua ativo:

- `BANCO_HOST`
- `BANCO_PORTA`
- `BANCO_USUARIO`
- `BANCO_SENHA`
- `BANCO_NOME`
- `BANCO_SSL`

## Criacao do banco no Neon

1. Acessar `https://console.neon.tech/`.
2. Entrar com GitHub, Google ou email.
3. Criar um projeto chamado `octaclin-staging`.
4. Escolher uma regiao proxima do ambiente do backend.
5. Manter o Postgres padrao sugerido pela plataforma.
6. Criar ou selecionar o database `octaclin`.
7. Criar ou selecionar a role de aplicacao.
8. Abrir o modal `Connect`.
9. Selecionar branch `main`, database `octaclin` e a role da aplicacao.
10. Copiar a connection string direta, sem connection pooling, para uso inicial do backend.

## Variaveis para o backend

Opcao recomendada:

```env
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/octaclin?sslmode=require
BANCO_SSL=true
BANCO_EXECUTAR_MIGRACOES=true
```

Opcao alternativa, se preferirmos separar a connection string:

```env
BANCO_HOST=host.neon.tech
BANCO_PORTA=5432
BANCO_USUARIO=usuario
BANCO_SENHA=senha
BANCO_NOME=octaclin
BANCO_SSL=true
BANCO_EXECUTAR_MIGRACOES=true
```

## Primeiro smoke esperado

Depois que o backend estiver apontando para o Neon:

1. Subir o backend com as variaveis de staging.
2. Validar `GET /health`.
3. Confirmar que as migrations foram aplicadas.
4. Executar o seed de staging, se optarmos por usuario demo operacional.
5. Fazer login usando:
   - API: URL do backend staging.
   - Tenant: `clinica-carla`, caso use o seed demo.
   - Email: `admin@octaclin.local`, caso use o seed demo.
   - Senha: `OctaClin@123`, caso use o seed demo.

## Observacoes de seguranca

- Nao commitar a connection string real.
- Usar banco separado de qualquer ambiente local ou futuro ambiente de producao.
- Rotacionar a senha da role caso ela seja exposta em prints, logs ou conversa.
- Deixar `BANCO_EXECUTAR_MIGRACOES=true` apenas enquanto o deploy inicial estiver sendo estabilizado; depois podemos mover migrations para um job controlado.

## Validacao local

- Backend typecheck: aprovado.
- Backend build: aprovado.
- Backend testes unitarios: 16 suites e 44 testes aprovados.
- Verificacao de referencias indevidas ao sistema usado como modelo: aprovada.
- Verificacao ASCII dos arquivos da fase: aprovada.
