# Relatorio de reconciliacao e encerramento — SQ-4

Data: 2026-09-08

Repositorio: `octanutri-clin/octaclin`

Base reconciliada: `98b6e5f17e7f4eae07b3fb537a91aea1d9e37394`

## Resultado

A fotografia ativa contem 215 alertas abertos: 213 Trivy, 2 Dependabot e 0
Secret Scanning. Todos continuam no GitHub e aparecem exatamente uma vez no
inventario versionado. O SQ-4 nao realizou dismiss nem declarou como corrigido
qualquer residuo.

| Causa raiz | Alertas | Severidade observada | Disposicao | Revisao |
| --- | ---: | --- | --- | --- |
| Base Python da imagem IA sem patch | 173 | 3 critical, 51 high, 57 medium, 57 low, 5 none | `aguardando_upstream` | 2026-09-20 |
| OpenSSL da base oficial Node 22 Alpine | 40 | 4 high, 12 medium, 24 low | `aguardando_upstream` com bloqueio do artefato suportado | 2026-09-14 |
| `image-size` transitivo do Metro | 2 | 2 high | `aguardando_upstream`, `SC-2026-005` | 2026-12-01 |

O total historico de 240 alertas do SQ-0 permanece auditavel no PR `#210` e no
historico Git. O arquivo canonico passa a representar a fotografia ativa; ele
nao conserva contagens obsoletas como se fossem o estado corrente.

## Evidencia do Security tab

A captura sanitizada ocorreu em `2026-09-08T17:48:33.318Z` sobre o SHA integral
acima:

- Code Scanning: 213, todos produzidos pelo Trivy;
- categorias: 173 `trivy-imagem-ia-service`, 20 `trivy-imagem-backend` e 20
  `trivy-imagem-web`;
- Dependabot: `#35` e `#36`, ambos `image-size`, sem first patched version;
- Secret Scanning: zero;
- Semgrep: zero alerta aberto; `#76`, `#82` e `#83` sairam do conjunto ativo
  depois do merge do PR `#214` e do scan da `main`.

## Classificacao da imagem IA

Os 173 resultados nao informam versao corrigida. A procedencia por componente
e camada orientou a decisao: o SQ-1C removeu do runtime `pip`, `msgpack` e
`setuptools`, que pertenciam ao tooling da base, sem remover as dependencias
travadas da aplicacao. O conjunto residual pertence a componentes da imagem
oficial e permanece sem patch no snapshot.

A imagem final executa como usuario nao-root, nao leva pip global e conserva
lock por hash. A integracao de IA e opcional e exige URL e token juntos; isso
reduz alcance, mas nao fecha CVE. Uma nova base so sera aceita se preservar
suporte, compatibilidade, health real, SBOM e reproducibilidade.

## Classificacao das imagens Node

Os 40 resultados apontam `libcrypto3`/`libssl3` `3.5.7-r0` e informam
`3.5.8-r0` como versao corrigida. Eles nao foram classificados como resolvidos.

Em `2026-09-08T17:41:35Z`, consulta autenticada ao registry oficial confirmou
que `node:22-alpine` continuava no digest
`sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32`,
o mesmo fixado nos Dockerfiles de backend e web. A versao corrigida existe no
repositorio Alpine, mas ainda nao compoe o artefato oficial aceito. Um `apk
upgrade` mutavel quebraria a politica de reproducibilidade e nao foi adotado.

Por isso, `aguardando_upstream` com patch informado agora exige
`bloqueioUpstream` nao vazio. O gate reprova uma classificacao desse tipo sem a
justificativa verificavel.

## Classificacao Mobile

Dependabot `#35` e `#36` seguem sem patch. A excecao `SC-2026-005` documenta a
cadeia transitiva do Metro, o risco de negacao de servico no build e o Mobile
NO-GO. A excecao e um controle temporario, nao uma dispensa do alerta.

## Provas do merge SQ-3

Sobre `98b6e5f`, todos os workflows obrigatorios executados concluiram com
sucesso:

- Semgrep run `34256077482`;
- Trivy run `34256077527`, incluindo builds e identidade das tres imagens,
  SBOM CycloneDX e Provenance do SBOM;
- CodeQL run `34256077546`;
- OctaClin CI run `34256077528`, incluindo backend, web, Mobile, FastAPI,
  governanca, rollout, operacao e smoke local.

O ultimo monitor de producao observado continua sendo o run agendado
`34244302631`, concluido com sucesso sobre `ee9cfed`. Ainda nao houve nova
execucao agendada do monitor sobre `98b6e5f`; portanto ele nao e apresentado
como prova pos-merge deste SHA.

## Gate versionado

O inventario declara `gateEncerramentoSq4: true`. O validador agora reprova:

- cobertura incompleta ou duplicada;
- owner, onda ou revisao ausente/vencida;
- Secret Scanning diferente de zero;
- causa ainda em `investigar`;
- causa critical/high ainda classificada como `corrigir`;
- `aguardando_upstream` com patch informado e sem `bloqueioUpstream`.

O teste foi escrito primeiro e falhou em seis pontos esperados: contrato de
upstream, gate SQ-4 e inventario ainda com 240 alertas. Depois da implementacao,
43 testes do inventario/captura passaram e a CLI confirmou 215 alertas cobertos.

## Criterio de aceite da PR

- gates locais completos verdes;
- checks da PR verdes, inclusive novo Trivy/SBOM;
- nenhuma divergencia entre o snapshot e o Security tab;
- revisao humana e merge humano;
- recaptura posterior se o Security tab mudar durante a revisao.

Somente depois do merge este documento autoriza avancar para PR 53. Alertas
aguardando upstream permanecem abertos e nao impedem o trabalho independente;
qualquer critical/high novo e corrigivel interrompe a retomada.
