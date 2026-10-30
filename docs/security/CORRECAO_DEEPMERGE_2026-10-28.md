# Mobile: remoção de deepmerge do grafo Expo

> O checkpoint abaixo substitui a conclusão operacional histórica registrada para a primeira estratégia. As etapas antigas foram preservadas ao final para rastreabilidade.

## Estado atual — PR #453 Draft, correção local validada; CI/R4 pendentes

**`deepmerge@4.3.1` foi removido do grafo instalado** por um patch versionado de `@expo/config@57.0.9`. A resolução a partir do consumidor Expo falha com `MODULE_NOT_FOUND`; o lockfile não contém mais o pacote. Nenhum waiver, waiver de auditoria, downgrade ou mudança de severidade foi usado.

A janela obrigatória de 24 horas expirou em **30/10/2026 16:41:28 UTC**. O override foi atualizado de `decode-uri-component@<0.5.0: 0.5.0` para `<0.5.1: 0.5.1` no workspace Mobile, e o lockfile agora resolve `query-string` para `decode-uri-component@0.5.1` com a integridade publicada no registry. O advisory `GHSA-qr28-fpjm-wq7f` deixou de aparecer no audit. A auditoria do projeto conclui com código 0 aceitando somente o backport local validado existente de `node-forge@1.4.0` (`GHSA-86w9-cpqp-85rv`); isso continua registrado como mitigação temporária, não como ausência de advisory upstream. Não foi incluído waiver, supressão ou alteração de severidade.

A solução candidata altera só o consumidor Expo: substitui as duas chamadas a `deepmerge` em `mergeConfigModifications` por um merge recursivo local para valores de configuração JSON-like, preservando concatenação de arrays e usando propriedades de dados próprias para que `__proto__` não chame setter herdado. Mantém a licença MIT e o aviso de copyright de `@expo/config`; não copia código de `deepmerge`. A alteração é específica a `@expo/config@57.0.9`; upgrades desse pacote exigirão reaplicar/retirar o patch e repetir a compatibilidade.

### RED/GREEN e validação local descartável

Ambiente isolado limpo em `/tmp/octaclin-mobile-453-verify`, Node **22.21.1** e pnpm **11.25.0**. Nenhuma dependência direta foi adicionada, migration ou configuração externa foi alterada.

- **RED de grafo:** o novo teste de que Expo não resolve `deepmerge` falhou no estado original (`Missing expected exception`).
- **RED de semântica:** a primeira versão do substituto falhou nos casos de concatenação de arrays aninhados e de propriedades de plugin. Corrigida para combinar arrays recursivamente.
- **GREEN:** testes de segurança **19/19**, acessibilidade estática **15/15**, typecheck PASS, frozen install PASS e export Expo completo para Web/iOS/Android PASS.
- Teste de integração atravessa `@expo/config.modifyConfigAsync` com fixtures sintéticas e `dryRun`, incluindo merge recursivo, arrays, propriedades de plugin, `__proto__`, `constructor`, `prototype`, configuração com e sem objeto `expo` e ausência de gravação.
- Comparação suplementar com entradas JSON-like determinísticas: **100/100** resultados iguais ao comportamento padrão anterior do deepmerge. É evidência exploratória local; o gerador/oráculo usado em `/tmp` não faz parte do repositório e esse número não substitui os testes versionados.
- **RED/GREEN da auditoria:** no baseline, `pnpm audit:security` falhou pelos advisories de decode-uri-component e pelo backport node-forge. Com a versão corrigida, passou e informou somente a mitigação local validada de node-forge.
- Em instalação limpa frozen: `pnpm test:security` **19/19 PASS**, `pnpm test:a11y` **15/15 PASS**, `pnpm typecheck` **PASS**, `pnpm audit:security` **PASS** (backport node-forge explicitamente reconhecido) e `pnpm build:validate` **PASS** para Web/iOS/Android.
- Expo Doctor: **18/21**, BLOCKED/FAIL por indisponibilidade de rede ao consultar Expo API/React Native Directory e por divergências de versões Expo/TypeScript já presentes no projeto; dependências não foram alteradas para mascarar esses resultados.
- Uma instalação anterior, na worktree mantida, conservou symlinks obsoletos de `deepmerge` após a regeneração intermediária. O teste falhou nesse estado local; a instalação clean reproduzível da árvore final removeu os links e passou 19/19. A worktree original não foi limpa nem descartada.
- **CI do novo HEAD ainda pendente.** O CI anterior `572c20c40decdddcc690b19aa12ee6ca0866e156` falhou em Mobile audit e PR Gate, como esperado antes da atualização. Seus checks de scanners restantes passaram; Mobile build foi skipped após a falha, e Provenance SBOM permaneceu skipped.
- Revisão independente somente leitura do delta de versão/override: **sem achados**, conferiu faixa, lock e integridade SHA-512; não executou testes.
- Revisão independente de segurança do patch `@expo/config`: **sem bypass/regressão concreto encontrado**; os cinco testes do contrato de merge passaram na worktree limpa. Escopo estático focado nos valores JSON comuns da configuração Expo; não caracterizou getters, `Symbol.toStringTag`, espécies de arrays ou protótipos JavaScript customizados e não substitui CI da PR.

### Próximos gates

1. Confirmar CI, scanners e resultado final de Rollout seguro no HEAD atualizado.
2. Manter #453 Draft até os checks aplicáveis concluírem. Depois da integração autorizada da correção de segurança, sincronizar #452 e executar os checks próprios dela.

**Sem autorização para merge ou deploy.** A auditoria do código local passou, mas #453 permanece Draft até CI e revisão independente. #452 continua bloqueada até sua base incluir a correção autorizada e seus próprios gates passarem. Mobile permanece NO-GO para distribuição.

---

## Estratégia anterior (histórica; substituída)

# deepmerge — correção mínima e gates separados

## Estado

**Outcome global: BLOCKED.** Correção comportamental comprovada nos vetores/controles abaixo; auditoria de dependências continua FAIL, Doctor parcialmente bloqueado por rede e build/scanners/CI ainda não concluídos. Não afirmar prontidão para merge ou distribuição Mobile. Sem waiver, mudança de severidade, supressão ou nova exceção.

Branch `fix/mobile-deepmerge-prototype`, base main `2f24fcb1`, PR própria de segurança, independente de #451/#452/#446 e G06. Somente arquivos Mobile, patch e este relatório. Sem deploy, migrations ou mudanças em infraestrutura.

## Finding e fronteira

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), consultado na API pública em 28/10/2026: `>=4.2.0, <=4.3.1`, severidade publicada **low**, `first_patched_version:null`, atualização em 27/10/2026. Não inferir que versão anterior/não listada seja segura. Não alterar metadados para aprovar gate.

Grafo travado: `@expo/config@57.0.9 -> deepmerge@4.3.1`. `@expo/config/build/Config.js` usa o pacote em `mergeConfigModifications` para configuração principal e propriedades de plugins. Os testes atravessam `modifyConfigAsync` com `dryRun:true`, configuração sintética e limpeza do diretório temporário.

Vetor: chaves próprias enumeráveis `__proto__` em target ou source, inclusive target de protótipo nulo. As três escritas de `mergeObject` atribuíam valores em `destination[key]`, acionando o setter herdado e alterando o protótipo do **objeto retornado**. Não confundir isso com poluição global de `Object.prototype` nem afirmar exploração remota de dados clínicos; o caminho confirmado é de configuração/ferramentas Expo.

## Estratégia e licença

Patch pnpm em `patches/deepmerge@4.3.1.patch`: substituir as três escritas por `Object.defineProperty` com propriedade própria enumerável/configurável/writable, em **index.js, dist/cjs.js e dist/umd.js**. Preservar expressões, valores, filtros, símbolos, campos legítimos constructor/prototype, callbacks e clonagem. Não remover dados indiscriminadamente nem trocar SDK.

`main` do pacote é `dist/cjs.js`; import() apenas faz interop com esse CJS. Não há distribuição ESM própria. UMD é testado separadamente. Fonte `index.js` foi revisado e corrigido, mas não carregado diretamente: seu `is-mergeable-object` é devDependency upstream ausente neste grafo; não instalar dependência só para alegar cobertura.

Licença instalada `license.txt`: **MIT**, copyright de James Halliday, Josh Duff e colaboradores; permissões/notices originais continuam no pacote e não foram removidos. Nenhum novo fornecedor/dependência; versão mantida, patch/hash rastreáveis no workspace/lockfile. Nenhuma alteração em audit-seguranca-lib, severidade ou ledger de exceções.

## TDD e verificações reais

Node **22.23.4**, pnpm **11.25.0**, instalação frozen e depois frozen/offline aprovadas; versões e controles do repositório preservados.

| Gate | Resultado e escopo |
| --- | --- |
| RED funcional | 16 testes iniciais: **13 FAIL/3 PASS** antes do patch, incluindo consumidor Expo dryRun; protótipo retornado inesperado. Um erro inicial de SDK da fixture foi corrigido antes desse RED e não contado como vulnerabilidade |
| GREEN direcionado inicial | **16/16 PASS** após patch |
| Casos finais direcionados | **20/20 PASS**, com getters/arrayMerge e caminho de plugin adicionados como controles |
| Segurança Mobile | `pnpm --dir octaclin-mobile test:security`: **34/34 PASS**, incluindo backports anteriores e novo teste |
| Typecheck | `pnpm --dir octaclin-mobile typecheck`: PASS |
| Acessibilidade estática | `pnpm --dir octaclin-mobile test:a11y`: **15/15 PASS**; não é interação humana/leitor de tela |
| Instalação congelada | `pnpm --dir octaclin-mobile install --frozen-lockfile --offline`: PASS |
| Sintaxe/diff | `node --check octaclin-mobile/scripts/deepmerge-seguranca.spec.mjs`; `git diff --check`: PASS |
| Auditoria real | `pnpm --dir octaclin-mobile audit:security`: **FAIL**, exit1, GHSA-86w9-cpqp-85rv e GHSA-gcqx-w48m-w2h4 continuam reportados |
| Expo Doctor | `EXPO_OFFLINE=1 pnpm --dir octaclin-mobile run doctor`: **19/21**, schema/React Native Directory não concluídos por `fetch failed`/resposta de rede. Não enfraquecer checks nem TLS |
| Build/export Mobile | NOT RUN local; espaço observado insuficiente para tratar export completo como seguro. Executar no CI, sem marcar PASS por testes de merge |
| CI/scanners do patch | PENDENTES no HEAD próprio; não herdar resultados #451/#452 |

Testes cobrem cópia target/source, protótipo nulo, aninhamento, arrays, all, clone:false, customMerge, getters, símbolos, constructor/prototype legítimos, filtros herdados/não enumeráveis, CJS realmente resolvido do Expo, interop import(), UMD, configuração principal e propriedades de plugin. Prova negativa verifica protótipo do resultado, ausência de campo herdado injetado e ausência de poluição global; prova legítima verifica conteúdo/descritivos e entradas intactas/dryRun sem gravação.

## Revisões independentes

- Investigação de fronteira: `/root/mobile_deepmerge_boundary`, nova instância sem histórico, somente leitura; rastreou consumidores e artefatos, identificou limites do gate/licença/entrypoints. **Não executou testes**.
- Revisão do candidato: `/root/mobile_deepmerge_patch_review`, nova instância sem racional/resultados fornecidos, somente leitura. Nenhum bypass/regressão concreto encontrado; **executou 20/20 testes direcionados e diff check**. Outras verificações foram estáticas. Não executou build/instalação/CI. Não equivale a R4 integral de FOOD07.
- Limite: callbacks personalizados podem retornar objetos arbitrários ou opções preservar referências; esses resultados fora de `mergeObject` não são sanitizados por este patch. Não prometer sanitização universal de objetos JavaScript.

## Por que a auditoria continua reprovada

O audit identifica a **versão/faixa**, não a execução dos bytes corrigidos. Não há release corrigido declarado pelo advisory. O backport node-forge existente teve regressão aprovada; a presença conjunta de deepmerge faz o avaliador atual falhar fechado. Não é prova de regressão daquele backport.

Sem waiver novo, o gate só poderá ser encerrado com release upstream corrigido ou retirada/substituição comprovadamente compatível da dependência no consumidor real, em decisão própria. Este backport fecha os vetores reproduzidos, mas **não encerra o gate global** e não concede distribuição Mobile. A PR permanece Draft até as condições serem demonstradas.

## Rollback e continuidade

Sem dados persistentes, schema ou configuração operacional alterados. Reverter patch/lockfile reintroduziria o vetor: não recomendar essa reversão como correção. Manter Mobile NO-GO, acompanhar release upstream e executar build/Doctor/scanners em ambiente compatível. Não baixar SDK/dependências arbitrariamente nem alterar audit para esconder o advisory. FOOD07 domínio pode continuar independentemente.
