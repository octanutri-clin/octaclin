# Relatorio de seguranca - PR 41

Data: 2026-08-30
Risco: R4
Escopo: MFA TOTP, codigos de recuperacao e reautenticacao privilegiada
Branch: `security/governanca-pr41-mfa-reauth`
Base: `origin/main` em `31b8d36` (merge do PR GitHub `#163`)

Nenhum banco externo, provider, secret real, PHI ou PII foi acessado. A
migration `1720000001037` nao foi executada contra Neon, staging ou producao.
Nenhuma variavel foi alterada no Render e nenhum deploy foi realizado. Todos os
dados usados nas validacoes sao sinteticos.

## 1. Modelo de ameacas e politica

O PR fecha quatro caminhos de ataque do ciclo de autenticacao privilegiada:

1. senha comprometida usada para abrir uma sessao administrativa;
2. tentativa de reutilizar um codigo TOTP ou um codigo de recuperacao;
3. sessao desbloqueada usada para alterar o proprio fator ou encerrar sessoes;
4. segredo exposto fora do enrolment ou codigo/desafio MFA exposto em log,
   auditoria ou resposta publica desnecessaria.

A obrigatoriedade nao depende de uma lista manual de nomes de papel.
`exigeMfaPorPapel` deriva a decisao das capabilities efetivas do papel. Assim,
SuperAdmin e qualquer papel que receba uma capability privilegiada precisam de
MFA; um novo papel administrativo nao entra sem MFA por esquecimento em outra
lista.

O segundo fator e TOTP compativel com aplicativos autenticadores, usando SHA-1,
6 digitos, passo de 30 segundos e janela de tolerancia de um passo. A chave TOTP
e cifrada pelo envelope AES-GCM existente. Codigos de recuperacao sao exibidos
uma unica vez e persistidos somente como SHA-256.

## 2. Fluxo de login e recuperacao

- O login por senha nao emite access/refresh token quando o papel exige MFA.
- A API interna de emissao de sessao tambem recusa papel privilegiado sem a
  marca temporal de MFA, impedindo bypass por um novo chamador de backend.
- O backend cria um desafio assinado, com audience propria, validade de cinco
  minutos e registro de uso unico no banco.
- O BFF guarda o desafio em cookie `HttpOnly`, `SameSite=Lax` e `Secure` fora de
  desenvolvimento; o valor nao entra no corpo devolvido ao navegador.
- Primeiro acesso privilegiado inicia configuracao do fator. A sessao so nasce
  depois da confirmacao do TOTP.
- Acesso posterior aceita TOTP ou um codigo de recuperacao ainda nao usado.
- O contador TOTP e atualizado condicionalmente, impedindo replay do mesmo passo.
- Tentativas de MFA e de reautenticacao passam pelo limitador atomico Redis.
- Regenerar codigos invalida os anteriores; o texto dos codigos nao entra em log
  nem auditoria.

## 3. Reautenticacao e acoes criticas

`ServicoReautenticacao` confirma a senha atual e emite uma prova curta, assinada
com chave derivada por finalidade e vinculada a tenant, usuario e sessao. O BFF
mantem essa prova somente em cookie `HttpOnly`; `GuardaReautenticacao` exige a
prova nas rotas marcadas com `ReautenticacaoObrigatoria`.

As seguintes acoes passaram a exigir reautenticacao:

- iniciar/reiniciar e confirmar configuracao MFA;
- regenerar codigos de recuperacao;
- remover o fator;
- limpar o historico inativo de sessoes;
- encerrar outras sessoes ou todas as sessoes.

Confirmar, reconfigurar ou remover o fator revoga as sessoes existentes. Access
tokens privilegiados sem a claim `mfa: true` falham no `GuardaJwt`; refresh de
sessao privilegiada sem `mfa_verificado_em` e revogado com o motivo
`mfa_obrigatorio`.

## 4. Auditoria sem material sensivel

O backend registra os eventos `auth.mfa.habilitado`, `auth.mfa.validado`,
`auth.mfa.codigo_recuperacao_usado`, `auth.mfa.reconfigurado`,
`auth.mfa.codigos_regenerados`, `auth.mfa.removido`,
`auth.reautenticacao.concluida` e `auth.reautenticacao.falhou`.

Os eventos nao incluem segredo TOTP, URI `otpauth`, codigo digitado, codigo de
recuperacao, token, hash de token ou prova de reautenticacao.

## 5. Migration 1037 e isolamento

`1720000001037-CriarMfaEReautenticacao` e aditiva e cria:

- `mfa_fatores_usuario`;
- `mfa_codigos_recuperacao`;
- `mfa_desafios`;
- `sessoes_usuario.mfa_verificado_em`;
- motivo de revogacao `mfa_obrigatorio`.

As tres tabelas novas possuem chave estrangeira composta para o usuario do
mesmo tenant, constraints de coerencia, RLS habilitada e forcada e policy com
`USING` e `WITH CHECK` baseados em `app.tenant_id`. A migration tambem cria os
indices parciais `idx_mfa_desafios_validos` e
`idx_mfa_codigos_disponiveis`.

## 6. Interface e BFF

- O login suporta configuracao inicial, verificacao TOTP e codigo de recuperacao.
- A chave manual de configuracao e os codigos de recuperacao sao apresentados
  apenas quando precisam ser registrados pelo usuario.
- A area de conta mostra estado do MFA e permite configurar, regenerar codigos
  ou remover o fator depois da reautenticacao.
- Acoes criticas de sessoes pedem a senha antes da mutacao.
- Os estados novos de login foram validados com axe-core em desktop e mobile.

Nao foi adicionada dependencia de QR Code: a chave manual evita ampliar a cadeia
de suprimentos neste PR. QR pode ser avaliado depois como melhoria de UX sem
alterar o contrato de seguranca.

## 7. Validacoes executadas

- PASS - backend completo: 164 suites aprovadas, 4 ignoradas; 1.251 testes
  aprovados e 28 ignorados.
- PASS - testes focados de auth/MFA/migration: 3 suites e 37 testes.
- PASS - backend `typecheck` e `build`.
- PASS - web `typecheck`, `lint` (0 erros e 52 warnings preexistentes) e `build`.
- PASS - Playwright MFA e sessoes: 22/22 em desktop e mobile, incluindo
  axe-core nos estados novos de MFA.
- PASS - gate amplo de acessibilidade web: 264/264.
- PASS - `pnpm test:security`, `pnpm security:secrets`,
  `pnpm test:confiabilidade` (20 referencias criticas) e `git diff --check`.
- SKIPPED - aplicacao e verificacao real da migration em PostgreSQL. O host nao
  possui Docker/Testcontainers disponivel e nenhuma URL externa foi usada sem
  autorizacao operacional especifica.

O Node local e `24.18.0`, enquanto o pacote web declara `>=22 <23`. Os gates
passaram, mas o CI deve continuar usando a versao suportada pelo repositorio; o
resultado local em Node 24 nao substitui o CI.

## 8. Rollout depois do merge

1. Criar branch de backup no Neon do ambiente alvo.
2. Confirmar explicitamente projeto, branch, banco e role `neondb_owner`.
3. Manter `BANCO_EXECUTAR_MIGRACOES=false` no runtime.
4. Aplicar somente a migration `1720000001037` fora de banda e executar
   `migration:show`. Se qualquer migration anterior aparecer pendente, parar.
5. Remover `DATABASE_URL` da sessao local imediatamente.
6. Verificar RLS habilitada e forcada, as tres policies, indices, constraints e
   a coluna `mfa_verificado_em` conforme `RUNBOOK_PRODUCAO.md`.
7. Implantar backend e depois web.
8. Fazer smoke sintetico: login privilegiado, enrolment, login TOTP, recovery
   code, reautenticacao e revogacao de sessoes; confirmar auditoria sanitizada.

## 9. Rollback

Nao executar `migration:revert` nem o `down` como resposta automatica a falha de
deploy. A migration e aditiva e pode permanecer enquanto o commit anterior e
reimplantado. Depois que usuarios criarem fatores, reverter o schema apaga os
fatores e codigos; isso exige decisao humana, backup confirmado e novo plano de
acesso. O rollback preferencial e reimplantar o codigo anterior mantendo o
schema aditivo.

## 10. Riscos residuais

- A migration e o RLS ainda precisam de prova em PostgreSQL real no ambiente
  autorizado; este resultado esta explicitamente `SKIPPED`, nao `PASS`.
- O fluxo usa chave manual em vez de QR Code. Isso afeta ergonomia, nao a
  resistencia criptografica do fator.
- O primeiro rollout exige comunicacao: contas privilegiadas sem fator serao
  conduzidas ao enrolment e sessoes antigas serao recusadas/revogadas.
- O PR 42 ainda precisa revisar autorizacao de objeto e funcao; MFA nao substitui
  BOLA/BFLA/IDOR nem isolamento por tenant.
