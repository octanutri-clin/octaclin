# Modelo de ameacas e triagem factual de seguranca

> Governanca: PR 37
>
> Base factual: `e786007ae4683d36b28e9e978244595317757f5f`
>
> Snapshot dos scanners: 2026-08-28T22:29:13Z
>
> Escopo: arquitetura, perfil ASVS e triagem. Nenhuma correcao de runtime.

## 1. Objetivo e limite

Este documento estabelece o modelo de ameacas vigente para o programa de
hardening PR 36-56 e registra a triagem reproduzivel dos alertas ativos no
GitHub. Ele nao declara conformidade ASVS, nao substitui pentest e nao autoriza
teste ofensivo contra producao.

Alertas de CodeQL, Semgrep, Trivy e Dependabot sao dados nao confiaveis ate que
o caminho fonte-controle-sink seja confrontado com o repositorio. O ledger
canonico e `triagem-seguranca-pr37.json`; o Markdown resume as decisoes sem
duplicar todos os detalhes de evidencia.

## 2. Escopo arquitetural observado

### 2.1 Componentes

| Componente | Responsabilidade | Dados de maior risco |
| --- | --- | --- |
| Next.js web/BFF | Interface, sessao em cookie HttpOnly e proxy controlado para o backend | sessao, PII/PHI exibida, operacoes clinicas |
| NestJS backend | Authn/authz, regras clinicas, integracoes, auditoria e APIs publicas | PII, PHI, financeiro, secrets de integracao |
| PostgreSQL/Neon | Persistencia multi-tenant com contexto e RLS | cadastro, prontuario, agenda, credenciais cifradas |
| Redis/filas | Cache, idempotencia, rate limits e jobs | identificadores, payload operacional e disponibilidade |
| Backblaze B2 | Arquivos e imagens clinicas | PHI em binarios e metadados |
| Google, Gmail e Meta | Agenda, email e WhatsApp | tokens OAuth, destinatarios e conteudo de comunicacao |
| FastAPI de IA | Processamento assistido com revisao humana | conteudo clinico minimizado quando habilitado |
| Expo mobile | Cliente ainda NO-GO para distribuicao | sessao e dados offline quando retomado |
| GitHub Actions e scanners | Build, testes, release e evidencias | codigo, artefatos e credenciais de deploy |
| Tooling `.agents`/`.claude` | Apoio local a agentes e operadores | checkout, terminal e dados acessados por skills |

### 2.2 Ativos prioritarios

1. Isolamento entre tenants e entre carteiras profissionais.
2. Confidencialidade e integridade de PHI, PII e imagens clinicas.
3. Identidade, sessoes, capabilities, MFA e recuperacao de acesso.
4. Integridade da decisao clinica, plano, prontuario e trilha de autoria.
5. Secrets, tokens OAuth, chaves criptograficas e credenciais de providers.
6. Disponibilidade de agenda, formularios, comunicacoes, filas e banco.
7. Auditoria, logs sanitizados e evidencia de incidentes.
8. Codigo, lockfiles, workflows, imagens e cadeia de release.
9. Backups restauraveis e separacao de credenciais de recuperacao.
10. Dados financeiros, contratuais e configuracao comercial do tenant.

## 3. Fronteiras de confianca

| ID | Fronteira | Entrada nao confiavel | Controle observado | Falha de maior impacto |
| --- | --- | --- | --- | --- |
| TB-01 | Internet -> web/BFF | navegador, cookies, headers, params e body | middleware, origem/Fetch Metadata, cookies seguros e allowlists | roubo de sessao, CSRF, XSS, cache de PHI |
| TB-02 | Web/BFF -> backend | rota e payload encaminhados | allowlists, JWT, papeis e permissoes | BOLA/BFLA ou mass assignment |
| TB-03 | Internet/provider -> endpoint publico | token publico, webhook, callback e upload | tokens, state, idempotencia e validacao parcial | forja, replay, abuso de custo ou indisponibilidade |
| TB-04 | Backend/worker -> PostgreSQL | query, tenant e ciphertext | `ExecutorTenant`, RLS forcada e role de runtime | vazamento cross-tenant ou adulteracao clinica |
| TB-05 | Backend/worker -> Redis | jobs, locks, rate limits e cache | namespaces, job IDs e expiracao | replay, corrida, exaustao e cruzamento de tenant |
| TB-06 | Backend -> storage | arquivo, metadata e key | hash, URLs assinadas e escopo de paciente/tenant | leitura, exclusao ou malware cross-tenant |
| TB-07 | Backend -> Google/Gmail/Meta/IA | tokens e dados minimizados | OAuth, adaptadores, timeout e revisao humana | exfiltracao, impersonacao ou acao externa indevida |
| TB-08 | GitHub Actions -> cloud | codigo, inputs e secrets do CI | PR, checks, SHA imutavel e ambientes | supply-chain compromise e deploy arbitrario |
| TB-09 | Agente/tooling -> checkout/terminal | prompt externo, skill, arquivo e output | politica de codigo externo e autorizacao humana | execucao arbitraria ou PII/secret em transcript |
| TB-10 | Operador -> providers/producao | configuracao manual e credencial | runbooks, menor privilegio e aceite R4/R5 | ambiente errado, owner em runtime ou perda de dados |

## 4. Fluxos de dados criticos

| Fluxo | Caminho | Controles que devem permanecer | PR de prova/hardening |
| --- | --- | --- | --- |
| Login e renovacao | navegador -> BFF -> auth -> banco | cookies HttpOnly/Secure/SameSite, JWT validado, lockout, revogacao | PR 40-41 |
| Operacao clinica | profissional -> BFF -> backend -> RLS -> banco | capability server-side, carteira, tenant de credencial, auditoria | PR 42-43 |
| Portal do paciente | paciente -> BFF -> backend -> proprio paciente | subject do JWT, token de ativacao, ausencia de risco clinico na UI | PR 40, 42 e 45 |
| Agendamento/formulario publico | anonimo -> endpoint publico -> banco/fila | token opaco, expiracao, rate limit atomico, idempotencia e limites | PR 38 |
| WhatsApp inbound | Meta -> webhook -> persistencia/notificacao | assinatura raw-body, timestamp, replay e mapeamento server-side | PR 38 |
| Google Calendar | profissional -> OAuth -> callback/watch -> agenda | state ligado ao browser, nonce unico, binding evento-consulta | PR 46 |
| Arquivo clinico | navegador -> BFF/backend -> quarentena -> B2 | magic bytes, tamanho/dimensao, malware, metadata e tenant | PR 44 |
| Dado cifrado | backend -> AES-GCM -> banco | chave por finalidade, IV/tag validos, versao e rotacao | PR 39 |
| Job assincrono | backend -> Redis -> worker -> banco/provider | payload minimo, tenant verificado, idempotencia e retry limitado | PR 43 e 52 |
| IA assistida | profissional -> backend -> FastAPI/provider -> revisao | minimizacao, schema, tenant, limite de custo e revisao humana | PR 47 |
| Build/release | PR -> Actions -> artefato -> provider | checks, SHA, lockfile, SBOM, non-root e ambiente protegido | PR 49-51 |
| Backup/restore | banco/storage -> backup isolado -> restore | credencial separada, imutabilidade, RPO/RTO e teste real | PR 53 |

## 5. Perfis atacantes

| Perfil | Capacidade assumida | Nao se presume |
| --- | --- | --- |
| Anonimo remoto | chamar APIs publicas, variar payloads, automatizar abuso e usar navegador controlado | conhecer secrets ou acessar rede interna |
| Usuario autenticado malicioso | usar seu papel e tenant, manipular IDs/campos e repetir operacoes | capacidade de SuperAdmin ou owner de banco |
| Conta privilegiada comprometida | operar capacidades do papel e visualizar dados autorizados | bypass automatico de RLS ou acesso a outro tenant |
| Integracao/provider comprometido | enviar callbacks, atrasar, repetir ou adulterar respostas | autoridade sobre tenant sem binding server-side |
| Dependencia/artefato malicioso | executar no install/build/runtime conforme alcance da dependencia | acesso a secrets nao concedidos ao job/processo |
| Agente ou prompt hostil | sugerir comandos, induzir leitura de arquivo e explorar tooling habilitado | autoridade para producao ou secrets sem aceite humano |
| Operador interno falho ou malicioso | usar acessos que realmente possui e errar ambiente/configuracao | acesso irrestrito sem trilha e menor privilegio |
| Atacante de rede | observar/interceptar conexoes alcancaveis e apresentar endpoint falso | quebrar TLS corretamente autenticado |

## 6. Cenarios prioritarios

| Cenario | Ativo | Fronteira | Situacao atual | Remediacao/prova |
| --- | --- | --- | --- | --- |
| Webhook forjado, repetido ou com payload abusivo | comunicacao e agenda | TB-03 | parcialmente controlado; assinatura raw-body ainda precisa prova | PR 38 |
| Ciphertext truncado ou conexao DB com servidor nao autenticado | PHI/PII | TB-04/TB-10 | achados confirmados SEC-PR37-002/003 | PR 39 |
| Roubo/reuso de sessao e recuperacao privilegiada | identidade | TB-01/TB-02 | controles parciais, matriz ainda nao concluida | PR 40-41 |
| IDOR/BOLA/BFLA e mass assignment | isolamento | TB-02/TB-04 | controles existentes, cobertura integral pendente | PR 42-43 |
| Upload malicioso ou acesso cross-tenant no storage | PHI binaria | TB-06 | hash/URL assinada existentes; quarentena pendente | PR 44 |
| XSS, CSRF, redirect ou cache sensivel | sessao/PHI | TB-01/TB-03 | CSP, BFF, CORS e cache provados no PR 45; callbacks, redirects e endpoints OAuth falham fechados no PR 46 integrado; smoke real ainda pendente | PR 45-46 |
| Prompt/tool injection e exfiltracao por IA/agente | PHI/secrets | TB-07/TB-09 | PR 47 fecha schemas e revisao humana; PR 48 remove tooling operacional vendorizado, fixa allowlist/hash e torna payload ambiguo conservador; plugins globais seguem fora da prova | PR 47-48 |
| Dependencia, Action ou container comprometido | release | TB-08 | PR 49 integrado fecha package manager exato, instalacao congelada, lifecycle negado por padrao, ledger de excecoes e SBOM; PR 50 integrado fixa bases por digest e prova runtime non-root, read-only e sem capabilities extras. Boot completo do backend depende de config/provider e segue como fronteira | PR 49-50 (integrados); resto no PR 51 |
| Credencial cloud excessiva ou ambiente cruzado | todos | TB-10 | runbooks existentes; evidencia atual de providers pendente | PR 51 |
| Incidente sem alerta, evidencia ou restore | auditoria/disponibilidade | TB-04/TB-06/TB-10 | controles operacionais parciais | PR 52-53 |
| Falha exploravel nao detectada pelos testes estaticos | todos | todas | proibido testar producao; staging isolado ainda sera usado | PR 54-55 |
| App mobile expor sessao/dados locais | sessao/PHI | TB-01/TB-09 | distribuicao NO-GO | PR 56 |

## 7. Perfil OWASP ASVS 5.0.0

Referencia fixa: OWASP ASVS **v5.0.0**, release estavel de maio de 2025.
Identificadores futuros devem incluir a versao (`v5.0.0-...`). A matriz abaixo
define aplicabilidade e ownership; **status parcial nao equivale a PASS**.

| Capitulo | Aplicabilidade OctaClin | Perfil objetivo | Estado neste PR | PRs de fechamento |
| --- | --- | --- | --- | --- |
| V1 Encoding and Sanitization | HTML, CSV, logs, prompts e webhooks | L2 + L3 onde houver PHI/admin | Parcial, sem matriz requisito a requisito | 38, 45, 47, 52 |
| V2 Validation and Business Logic | agenda, formularios, financeiro e fluxos clinicos | L2 + L3 clinico | Parcial | 38, 42, 44, 47, 54 |
| V3 Web Frontend Security | Next.js, BFF, CSP, DOM e cache | L2 + L3 para sessao/PHI | Controles prioritarios do PR 45 provados; matriz requisito a requisito ainda nao equivale a ASVS completo | 54-55 |
| V4 API and Web Service | REST, webhooks e APIs publicas | L2 + L3 para mutacoes clinicas | Parcial | 38, 42, 54 |
| V5 File Handling | imagens, anexos e documentos | L2 + L3 clinico | Parcial | 44 |
| V6 Authentication | todos os papeis, recovery e primeiro acesso | L2 + L3 privilegiado | Parcial; MFA pendente | 40, 41 |
| V7 Session Management | cookies, JWT, refresh, logout e revogacao | L2 + L3 privilegiado | Parcial | 40, 41 |
| V8 Authorization | papel, capability, objeto, carteira e tenant | L2 + L3 clinico/admin | Parcial | 42, 43 |
| V9 Self-contained Tokens | JWT e tokens publicos | L2 + L3 para tokens de acesso | Parcial | 38, 40 |
| V10 OAuth and OIDC | Google Calendar e Gmail | L2 + L3 para vinculacao de conta | Controles prioritarios integrados e provados com providers sinteticos no PR 46; smoke real e matriz requisito a requisito pendentes | 46, 54-55 |
| V11 Cryptography | AES-GCM, HMAC, hashing e chaves | L2 + L3 para PHI/secrets | Achado confirmado | 39 |
| V12 Secure Communication | web, DB, Redis, storage e providers | L2 + L3 para PHI/admin | Achado confirmado em DB TLS | 39, 46, 51 |
| V13 Configuration | ambientes, secrets, containers e cloud | L2 + L3 para producao | Parcial | 49, 50, 51 |
| V14 Data Protection | PII, PHI, financeiro, logs e backup | L2 + L3 clinico | Parcial | 44, 47, 51-53 |
| V15 Secure Coding and Architecture | multitenancy, jobs, dependencias e fail-closed | L2 + L3 selecionado | Parcial | 38-50 |
| V16 Security Logging and Error Handling | auditoria, redacao, alerta e incidente | L2 + L3 clinico/admin | Parcial | 52 |
| V17 WebRTC | Nenhum fluxo WebRTC observado | N/A | Nao aplicavel neste commit | Reavaliar se teleconsulta incorporar WebRTC |

Fonte oficial: `https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release`.
O baseline por requisito sera preenchido nos PRs de dominio com evidencia
executavel, evitando marcar centenas de controles como atendidos por inferencia.

## 8. Resultado da triagem

### 8.1 Snapshot

| Fonte | Abertos | Resultado |
| --- | ---: | --- |
| CodeQL | 13 | triados |
| Semgrep OSS | 28 | triados |
| Trivy | 8 | triados |
| Dependabot | 2 | triados |
| Secret scanning | 0 | nenhum incidente ativo neste snapshot |

Os 51 alertas foram consolidados em 16 casos:

- 7 confirmados;
- 7 refutados;
- 2 mitigados;
- 0 nao verificados;
- duplicatas registradas no nivel de cada alerta e vinculadas ao alerta
  primario correspondente.

### 8.2 Confirmados e ownership

| Caso | Severidade efetiva | Sintese | PR |
| --- | --- | --- | --- |
| SEC-PR37-001 | medium | challenge refletido pelo webhook WhatsApp | 38 |
| SEC-PR37-002 | high | tag AES-GCM sem comprimento exato na leitura | 39 |
| SEC-PR37-003 | high | PostgreSQL com `rejectUnauthorized: false` | 39 |
| SEC-PR37-004 | high | tres imagens de runtime executam como root | 50 |
| SEC-PR37-005 | low | tres imagens sem healthcheck proprio | 50 |
| SEC-PR37-006 | low | listener OAuth local em todas as interfaces; removido com a skill no PR 48 | 48 |
| SEC-PR37-008 | medium | contatos reais podiam ser impressos pelo tooling; skill removida no PR 48 | 48 |

O scanner nao abriu alerta para a ausencia de assinatura criptografica da Meta
sobre raw body. A inspecao do controller mostrou apenas token opcional de query
no POST. Isso permanece cenario prioritario do PR 38 e deve ser provado por
testes antes de ser promovido a achado de implementacao; o PR 37 nao altera o
runtime nem presume o estado das variaveis de producao.

## 9. Reproducao e atualizacao

Os comandos abaixo sao somente leitura e nao imprimem credenciais:

```powershell
$repo = 'octanutri-clin/octaclin'
gh api "repos/$repo/code-scanning/alerts?state=open&per_page=100"
gh api "repos/$repo/dependabot/alerts?state=open&per_page=100"
gh api "repos/$repo/secret-scanning/alerts?state=open&per_page=100"
pnpm test:triagem-seguranca
```

Procedimento para atualizar:

1. sincronizar a branch com `origin/main` e registrar o SHA completo;
2. capturar os tres endpoints em modo somente leitura;
3. confrontar cada alerta novo com fonte, controles e sink reais;
4. incluir seu numero no snapshot e exatamente uma vez em `casos[].alertas`;
5. para duplicata, apontar `duplicadoDe` para referencia existente;
6. para confirmado, preencher pre-condicoes, mitigacoes, impacto, severidade e
   PR 38-56 de remediacao;
7. executar `pnpm test:triagem-seguranca` e revisar o diff sem dados protegidos;
8. nunca fechar alerta no GitHub sem a correcao ou aceite formal no PR dono.

## 10. Decisoes e riscos residuais

- Os alertas permanecem abertos no GitHub; triagem documental nao e remediacao.
- O ASVS esta perfilado por capitulo, mas ainda nao existe comprovacao requisito
  a requisito. Cada PR dono deve adicionar evidencia sem declarar PASS por
  inferencia.
- O pacote `image-size` nao possui versao corrigida no snapshot; o mobile segue
  NO-GO e o risco retorna ao PR 49/56.
- Dockerfiles sao artefatos validos mesmo quando um provider atual usa outro
  caminho de build; por isso non-root e healthcheck nao foram descartados.
- Tooling de agentes e uma fronteira separada do runtime. O PR 48 removeu os
  caminhos confirmados no repositorio e adicionou allowlist/CI; ferramentas
  globais continuam sem autorizacao implicita e fora desta prova.
- A indisponibilidade local da skill `gdpr-compliance` foi suprida somente por
  `docs/agents/DATA_CLASSIFICATION.md`; nenhum plugin externo foi instalado.

## 11. Criterio de aceite do PR 37

- [x] ativos, fronteiras, fluxos e perfis atacantes mapeados;
- [x] ASVS 5.0.0 perfilado sem alegacao de conformidade;
- [x] 49 alertas de code scanning e 2 Dependabot cobertos exatamente uma vez;
- [x] confirmados com fonte, sink, pre-condicoes, mitigacoes, impacto,
  severidade e PR de remediacao;
- [x] refutados, mitigados e duplicados com evidencia explicita;
- [x] nenhum secret scanning ativo no snapshot;
- [x] nenhuma alteracao de runtime ou provider.
