# Atualizações de dependências e imagens — PR405

## Escopo e procedência

Autorização do proprietário após a análise das PRs abertas do Dependabot.
HEAD recebido: `9e3948817f9173c9dee515e04e5a6d6c2c36119e`, worktree limpa.
Os checks desse HEAD passaram; provenance SBOM foi SKIPPED pela condição do
workflow. Esses resultados não aprovam automaticamente o incremento atual.

Integrada a proposta da [PR401](https://github.com/octanutri-clin/octaclin/pull/401):
lucide-react 1.48.0 → 1.52.0 e postcss 8.5.28 → 8.5.29, com lockfile regenerado
pelo pnpm11.25.0. A PR403 era opcional e não foi incorporada. Nenhuma PR do
Dependabot foi fechada ou mergeada nesta operação.

| Pacote | Antes | Depois | Alteração |
| --- | --- | --- | --- |
| libpcre2-8-0 | 10.46-1~deb13u2 | 10.46-1~deb13u3 | Novo digest oficial Python nos dois estágios |
| openssl-provider-legacy | 3.5.7-1~deb13u2 | 3.5.7-1~deb13u3 | Mesmo digest; libssl3t64 acompanha a revisão |
| zlib | 1.3.2-r0 | 1.3.2-r1 | Base Node compartilhada com instalação de versão exata |
| postcss-selector-parser | 6.1.4 | 7.1.6 | Override transitivo e testes de compatibilidade CSS |

Python: digest anterior `caaf356f40667c496d405780745b9ac25771c189a51dfcc42430d531ea09f8a2`;
novo `a2b82f3c48559aa0a8446d9af49826b6e2b2016f4cd2afabfe6013ec53729170`,
obtido de library/python:3.14-slim e confirmado por pull/inspect no Docker Hub.
As versões Debian foram conferidas por dpkg-query na imagem real linux/amd64.
O digest Node permanece inalterado; os quatro estágios derivam da base com zlib
corrigida. Não há instalação no estágio final, usuário root no runtime ou
relaxamento das regras de supply chain. Alpine v3.24/main oferece a versão em
x86_64 e aarch64; execução ARM64 não realizada localmente.

Parser 7.1.6: licença MIT e engines compatíveis conferidos no registro npm.
Tailwind3/postcss-nested6 declaravam parser6; o salto principal é explícito e
validado por geração de utilitários, nesting, escapes, atributos e pseudos.
O teste exige que ambos os consumidores resolvam 7.1.6 e roda no job Web do CI.
O peer warning de autoprefixer10.6.1 exige postcss8.5.23: já havia divergência
com 8.5.28 e continua com 8.5.29. Não foi ocultado; os testes e build avaliaram
esta configuração sem mudar o grafo para além do escopo solicitado.

## Evidências locais

Node22.23.3, pnpm11.25.0 e dados exclusivamente sintéticos.

| Verificação | Estado observado |
| --- | --- |
| Teste novo CSS antes da correção | FAIL esperado: parser6.1.4 vs7.1.6 |
| Teste novo Docker antes da correção | FAIL esperado: ausência da base corrigida |
| `pnpm install --frozen-lockfile` (web) | PASS |
| `pnpm test:css-security` | PASS4/4 |
| Dockerfiles, Node, pnpm e workflows sem injeção | PASS41/41 |
| Licenças, instalação congelada e lock Python | PASS11, 2 e 8 testes |
| Inventário real de licenças web | PASS395 pacotes |
| `pnpm typecheck` e `pnpm build` (web) | PASS |
| `pnpm lint` (web) | PASS sem erros; 65 warnings já existentes |
| `pnpm test:fase317:bff` | PASS8/8 |
| Playwright Fase317 + navegação portal | PASS14/14 desktop/mobile; axe nos cenários que já o executavam |
| Base Node com zlib corrigida | PASS build/consulta da versão linux/amd64 com mount CA temporário |
| Imagem IA atualizada | PASS build com mount CA temporário; UID10001, pip ausente, health200 com rootfs read-only/cap-drop/limites |
| Builds integrais Node locais | BLOCKED pelo proxy/registry; prova exata delegada ao CI |

Os Dockerfiles originais falharam localmente por confiança TLS do proxy; a
validação adaptada utilizou cópias temporárias e mount de CA em BuildKit.
Certificado não versionado nem persistido em layer. TLS não foi desativado.
Também houve falha de conectividade do Corepack ao registry mesmo com CA.
Não apresentar essas cópias como builds exatos dos Dockerfiles do repositório.

Trivy0.75.0 obtido da release oficial, checksum comparado antes da execução.
Scans de vulnerabilidades locais (mesma base de dados):

- Web: zero achados no filesystem analisado, incluindo o lockfile atualizado.
- Base Node corrigida: zero achados para zlib.
- Imagem IA corrigida: zero achados para libpcre2-8-0 e
  openssl-provider-legacy. A comparação somente de pacotes OS remove40 pares
  pacote/CVE (1 PCRE e13 em cada pacote OpenSSL/libssl/provider), sem novos pares.
- Permanecem166 achados OS na imagem IA (44 HIGH, 58 MEDIUM, 61 LOW, 3 UNKNOWN).
  São achados fora das quatro remediações solicitadas; a imagem não está livre
  de vulnerabilidades. Não ocultar, suprimir ou tratar scan warning como aceite.
- API de alertas GitHub: BLOCKED por HTTP403. O encerramento dos alertas na
  Security tab não foi comprovado e dependerá do scan remoto com o novo HEAD.
- `pnpm audit --json`: FAIL por um HIGH em braces3.0.3
  (GHSA-vfj7-8cjw-p6xm), sem versão corrigida indicada pelo advisory.
  Essa versão já estava no lockfile recebido e não foi alterada. O resultado
  difere do Trivy filesystem; não equiparar zero no Trivy a ausência de alertas
  de todos os fornecedores. Nenhum advisory do parser apareceu nesse retorno.

[Resumo verificável e hashes dos logs locais](../history/phases/reviews/fase-317/security-updates-verification.json).
Os hashes identificam os logs; não substituem os artefatos de scan/SBOM do CI.

## Reprodução e limites

```sh
pnpm --dir octaclin-web install --frozen-lockfile
pnpm --dir octaclin-web test:css-security
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:fase317:bff
node --test scripts/validar-dockerfiles-runtime.spec.mjs scripts/validar-versao-node.spec.mjs scripts/validar-versao-pnpm.spec.mjs scripts/validar-workflows-sem-injecao.spec.mjs
node scripts/validar-licencas.mjs octaclin-web/node_modules
cd octaclin-web
pnpm exec playwright test tests/visual/fase-317-gamificacao.spec.mjs tests/visual/portal-paciente.spec.mjs --grep 'Fase 317|navega por rotas reais com um unico carregamento' --project=desktop-chromium --project=mobile-chromium
```

O workflow Trivy mantém builds/harness/scan/SBOM das três imagens finais.
Validar o HEAD enviado e não reutilizar o verde anterior. O CI executará as
regressões integrais existentes. G01/G02/G05 da Fase317 permanecem bloqueados;
não houve nova revisão independente R4. Nenhuma migration alterada/aplicada,
deploy, merge, ativação clínica ou modificação de ambientes externos.

Rollback: reverter o incremento de dependências/imagens por commit revisado e
repetir builds/scans. Isso reintroduz as vulnerabilidades anteriores; não é
aceite de produção. Histórico, consentimentos, RLS e protocolos seguem intactos.
