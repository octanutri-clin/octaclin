# Fase 81 - Onboarding real do paciente

## Entregue

- A ativacao de convite agora emite sessao completa para usuario `Patient`.
- O backend reutiliza o emissor de sessao do modulo de autenticacao para gerar access token, refresh token, permissoes, escopo e destino inicial.
- A rota BFF de ativacao salva os tokens em cookies `HttpOnly` e nao devolve tokens ao JavaScript da tela.
- A tela de primeiro acesso redireciona automaticamente para o portal apos ativar o convite.
- Adicionado smoke visual de primeiro acesso cobrindo convite, senha, aceite LGPD, ativacao e abertura do portal sem login manual.
- O smoke visual foi serializado com `workers: 1` para evitar corrida entre Next dev, mocks e cookies.

## Decisoes

- O aceite LGPD continua obrigatorio antes da criacao da sessao.
- A ativacao do convite continua vinculando o paciente ao usuario recem-criado e marcando o convite como `aceito`.
- A sessao do primeiro acesso usa o mesmo contrato do login, mantendo cookies `HttpOnly` como fonte de verdade.
- O BFF usa `tenantId` como identificador de sessao quando o backend nao retorna `tenantSlug`.

## Validacao

- `pnpm --dir octaclin-backend exec jest --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `playwright test --grep "primeiro acesso|portal do paciente"`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 82: central do paciente com linha do tempo unificada de consultas, formularios, mensagens, perfil e privacidade.
