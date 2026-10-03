# Backports temporarios do toolchain Expo

O lockfile Expo ainda resolve `node-forge@1.4.0` e `braces@3.0.3`, versoes
atingidas pelos advisories abaixo. Na data desta alteracao, o npm nao publica
versoes corrigidas. Os arquivos em `patches/` aplicam mitigacoes locais; eles
nao representam releases upstream corrigidos.

| Pacote | Advisory | Mitigacao local |
| --- | --- | --- |
| `node-forge@1.4.0` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Rejeita elementos extras dentro da sequencia ASN.1 `DigestAlgorithm`, seguindo a [proposta upstream #1152](https://github.com/digitalbazaar/forge/pull/1152). |
| `braces@3.0.3` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Limita a profundidade dos blocos aninhados a 100 antes dos percursos recursivos da AST, conforme a [recomendacao no issue upstream #70](https://github.com/micromatch/braces/issues/70). |

`pnpm test:security` executa repros para ambos os casos. `pnpm audit:security`
so aceita esses dois advisories, com os pacotes e faixas afetadas exatos, quando
os patches estao registrados no lockfile e os repros passam. Qualquer outro
advisory, supressao, faixa ou pacote continua reprovando o gate. A mensagem do
gate informa que a correcao upstream esta pendente; `pnpm audit:raw` continua
reportando as versoes upstream vulneraveis.

Remova os patches e essa excecao assim que os mantenedores publicarem releases
corrigidos: atualize as dependencias, retire este documento e a logica de
mitigacao, e confirme que a auditoria bruta nao encontra os advisories.
