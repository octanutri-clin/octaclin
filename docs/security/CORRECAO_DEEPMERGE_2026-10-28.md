# Mobile: remoção de deepmerge do grafo Expo

> O checkpoint abaixo substitui a conclusão operacional histórica registrada para a primeira estratégia. As etapas antigas foram preservadas ao final para rastreabilidade.

## Estado atual — PR #453 Draft, gates parciais

**`deepmerge@4.3.1` foi removido do grafo instalado** por um patch versionado de `@expo/config@57.0.9`. A resolução a partir do consumidor Expo falha com `MODULE_NOT_FOUND`; o lockfile não contém mais o pacote. Nenhum waiver, waiver de auditoria, downgrade ou mudança de severidade foi usado.

A auditoria global está **BLOCKED** por um advisory High recém-publicado, `GHSA-qr28-fpjm-wq7f`, que afeta `decode-uri-component@0.5.0` (`<=0.5.0`, primeira versão corrigida `0.5.1`). O pacote corrigido foi publicado em **29/10/2026 16:41:28 UTC**, dentro do cooldown obrigatório de 24 horas de `minimumReleaseAgeStrict: 1440`. Não foi atualizado prematuramente. A auditoria também reporta `GHSA-86w9-cpqp-85rv` em `node-forge@1.4.0`, que segue tratado apenas pelo backport e testes já aceitos pela política existente; a combinação atual reprova `audit:security`. Não se acrescentou exceção para `decode-uri-component`.

A solução candidata altera só o consumidor Expo: substitui as duas chamadas a `deepmerge` em `mergeConfigModifications` por um merge recursivo local para valores de configuração JSON-like, preservando concatenação de arrays e usando propriedades de dados próprias para que `__proto__` não chame setter herdado. Mantém a licença MIT e o aviso de copyright de `@expo/config`; não copia código de `deepmerge`. A alteração é específica a `@expo/config@57.0.9`; upgrades desse pacote exigirão reaplicar/retirar o patch e repetir a compatibilidade.

### RED/GREEN e validação local descartável

Ambiente isolado em `/tmp`, Node **22.23.4** e pnpm **11.25.0**. Nenhuma dependência, migration ou arquivo de runtime da aplicação foi alterado fora de `octaclin-mobile`.

- **RED de grafo:** o novo teste de que Expo não resolve `deepmerge` falhou no estado original (`Missing expected exception`).
- **RED de semântica:** a primeira versão do substituto falhou nos casos de concatenação de arrays aninhados e de propriedades de plugin. Corrigida para combinar arrays recursivamente.
- **GREEN:** testes de segurança **19/19**, acessibilidade estática **15/15**, typecheck PASS, frozen install PASS e export Expo completo para Web/iOS/Android PASS.
- Teste de integração atravessa `@expo/config.modifyConfigAsync` com fixtures sintéticas e `dryRun`, incluindo merge recursivo, arrays, propriedades de plugin, `__proto__`, `constructor`, `prototype`, configuração com e sem objeto `expo` e ausência de gravação.
- Comparação suplementar com entradas JSON-like determinísticas: **100/100** resultados iguais ao comportamento padrão anterior do deepmerge. É evidência exploratória local; o gerador/oráculo usado em `/tmp` não faz parte do repositório e esse número não substitui os testes versionados.
- `pnpm audit:security`: **FAIL** pelos advisories `GHSA-qr28-fpjm-wq7f` (`decode-uri-component@0.5.0`) e `GHSA-86w9-cpqp-85rv` (`node-forge@1.4.0`); não ocultar essa falha. No CI do HEAD `79416b29c408c1153704c8107ac6595b146c7ba8`, os passos anteriores do Mobile passaram: instalação frozen, licenças, typecheck, Expo Doctor (21/21), segurança (19/19) e acessibilidade (15/15). O job Mobile falhou no passo `audit:security`, e o PR Gate falhou em consequência.
- No mesmo CI, Governança, CodeQL (JavaScript/TypeScript e Python), Semgrep, Trivy, Dependency Review e builds/identidade das imagens backend, IA e Web passaram. Web, backend, AI e demo smoke foram `skipped` pelo classificador de impacto; não contam como PASS. Provenance do SBOM foi `skipped`. O job Rollout seguro ainda aparece como pendente na consulta de checks, embora todos os seus passos listados estejam concluídos com sucesso; seu estado final precisa ser reconfirmado.
- A revisão independente do patch atual de `@expo/config` ainda não ocorreu. As revisões registradas abaixo dizem respeito à estratégia anterior e não substituem esta revisão.

### Próximos gates

1. Após **30/10/2026 16:41:28 UTC**, confirmar que `decode-uri-component@0.5.1` atende ao cooldown de 24 horas e atualizar o override de segurança existente sem waiver; então regenerar o lockfile sob as políticas atuais.
2. Reexecutar instalação frozen, audit, testes Mobile, typecheck, Expo Doctor e export.
3. Reconferir o resultado final do job Rollout seguro e solicitar revisão independente do patch atual de `@expo/config`.
4. Executar novamente CI/scanners no novo HEAD. Manter a #453 Draft até audit, gates e revisão independente passarem.
5. Manter a #452 Draft: ela não herda esta alteração até a integração autorizada da #453 na base e sua própria CI no HEAD atualizado.

**Sem autorização para merge ou deploy.** O app Mobile continua NO-GO até audit e CI aprovarem; #452 e #453 permanecem Draft.

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
