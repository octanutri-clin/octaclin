# Backport temporario do toolchain Expo

`node-forge` nao usa mais backport local: o registro npm publica `1.4.1` e `1.4.2`,
que corrigem os advisories anteriormente reportados para `1.4.0`. O workspace
fixa `node-forge@1.4.2` por override e removeu o patch local de `1.4.0`.

## Remediacoes upstream da auditoria Mobile (2026-11-04)

O CI da PR #446 encontrou 12 advisories de `node-forge`, um de `glob` e um de
`minimatch`. O lockfile seleciona releases corrigidas: `node-forge@1.4.2`,
`glob@14.0.2` e `minimatch@11.0.4`. O override de `glob` atravessa a major 14
porque a correcao publicada do advisory exige `>=14.0.2`; o export Expo completo
para Web, iOS e Android e usado como verificacao de compatibilidade. O override
de `minimatch` e restrito ao `@expo/fingerprint@0.20.13`, cujo intervalo
declarado ainda inclui a versao vulneravel.

O advisory `GHSA-gcqx-w48m-w2h4` de `deepmerge@4.3.1` informa que ainda nao ha
release corrigida publicada. A PR #453 ja removeu esse consumidor de
`@expo/config@57.0.9` e substituiu suas chamadas por merge local protegido. Um
override pnpm de remocao mantem essa aresta fora do grafo/lockfile, sem waiver;
testes confirmam que Expo nao resolve `deepmerge` e que a auditoria bruta nao
encontra advisories. Se o patch de `@expo/config` mudar, esses testes e a
resolucao do grafo devem ser reavaliados juntos.

O `Dependency Review` interpreta qualquer termo bloqueado em uma expressao OR
como incompatibilidade e nao permite registrar qual alternativa SPDX foi
escolhida. O proprietario ratificou o uso de `node-forge@1.4.2` sob
`BSD-3-Clause`, alternativa ja permitida pela politica e descrita no LICENSE do
pacote. A politica central registra a selecao; o workflow concede ao Dependency
Review uma permissao apenas para o PURL exato `pkg:npm/node-forge@1.4.2`. A
denylist global continua intacta, e qualquer outra versao volta a exigir a
revisao normal. O teste de licencas confirma a expressao real como permitida
pela alternativa BSD e verifica que o PURL do workflow e versionado.

O lockfile ainda resolve `braces@3.0.3`, atingido pelo advisory abaixo. Seu
patch local continua temporario e nao representa release upstream corrigida.

| Pacote | Advisory | Mitigacao local |
| --- | --- | --- |
| `braces@3.0.3` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Limita a profundidade dos blocos aninhados a 100 antes dos percursos recursivos da AST, conforme a [recomendacao no issue upstream #70](https://github.com/micromatch/braces/issues/70). |

`pnpm test:security` verifica o vetor sintetico de assinatura RSA contra a
release upstream atual de `node-forge` e reproduz o limite de aninhamento do
`braces` corrigido pelo patch local. `pnpm audit:security` aceita somente o
advisory `braces` com pacote/faixa exatos, patch registrado e teste aprovado.
Qualquer outro advisory, supressao, faixa ou pacote continua reprovando o gate.

Remova os patches e essa excecao assim que os mantenedores publicarem releases
corrigidos: atualize as dependencias, retire este documento e a logica de
mitigacao, e confirme que a auditoria bruta nao encontra os advisories.
