# Fase 243 - Modernizacao e hardening do Mobile

Data: 2026-08-20.

Integracao: PR `#84`, commits `069b7ce` e `bd91152`, merge `87b2f6a`.
CI: execucao `32430036184`, com os sete jobs aprovados.

## Objetivo

Remover a divida critica do ecossistema Expo sem ativar nem distribuir o app
Mobile. A fase substitui cinco atualizacoes isoladas do Dependabot por uma
migracao coordenada e suportada.

## Baseline confirmado

- Expo SDK 52, React Native 0.76 e React 18.
- `expo-av` descontinuado ainda presente.
- Auditoria local: 38 vulnerabilidades, sendo 1 critica, 26 altas e 11 medias.
- GitHub: 37 alertas no lockfile Mobile, sendo 1 critico, 26 altos e 10 medios.
- `expo-doctor`: 15 de 18 verificacoes aprovadas.
- PRs `#22`, `#24`, `#25`, `#29` e `#30` incompatíveis quando tratados
  isoladamente.

## Entrega tecnica

- Atualizacao incremental dos SDKs 52, 53, 54, 55, 56 e 57, executando em cada
  etapa o alinhamento de dependencias recomendado pelo Expo.
- Matriz final: Expo 57.0.15, React Native 0.86.2, React 19.2.3 e TypeScript 6.0.3.
- Substituicao de `expo-av` por `expo-audio`, com encerramento automatico aos
  120 segundos, restauracao do modo de audio em erro/desmontagem e sem servicos
  de gravacao ou reproducao em segundo plano.
- Configuracao Metro oficial para o WebAssembly usado pelo `expo-sqlite` na web.
- Remocao da dependencia direta `expo-file-system`, sem uso no aplicativo.
- Lockfile congelado no CI e novos gates Mobile: typecheck, Expo Doctor, testes
  do gate de seguranca, auditoria e export para Android, iOS e web.
- Overrides transitivos limitados para `js-yaml` 4.3.1 e `uuid` 11.1.1, com a
  configuracao nativa do Expo processada com sucesso.

## Seguranca de dependencias

O resultado local caiu de 38 para 2 vulnerabilidades. Foram eliminadas todas as
ocorrencias corrigiveis, inclusive o alerta critico de `tar`.

A API do GitHub confirmou o mesmo estado depois do merge: 2 alertas abertos,
ambos altos e ambos no pacote `image-size`.

As duas ocorrencias residuais sao `GHSA-w3rx-r6r6-pgpr` e
`GHSA-5p2g-fcmc-qvqq`, ambas em `image-size@1.2.1`, transitiva do Metro. Em
2026-08-20 o advisory informa `patched_versions: <0.0.0`: nao existe versao
corrigida. O gate `audit:security` aceita somente esse conjunto exato, exige
versao, severidade e caminho conhecidos, recusa avisos silenciados e falha para
qualquer vulnerabilidade nova ou divergencia. O comando `audit:raw` continua
disponivel para mostrar a auditoria sem tratamento.

Essa excecao nao equivale a audit zerado. Portanto, a regra permanece:
**nenhum build Mobile pode ser distribuido enquanto houver alerta critico ou
alto, mesmo com excecao formal**.

## Gates de distribuicao ainda fechados

- `mobile.sync=false` permanece fail-closed no backend.
- Identidade do aplicativo ainda usa `com.placeholder.appid`.
- A configuracao gerada ainda permite transporte arbitrario no iOS e backup no
  Android.
- A tela inicial ainda usa paciente/token locais de desenvolvimento e a API tem
  fallback HTTP para localhost.
- Dados clinicos e PIN ficam no SQLite sem criptografia, expurgo ou politica de
  backup do dispositivo.
- Foto e video exibem interface de captura, mas ainda nao geram URI nem lote
  sincronizavel; o fluxo de audio foi modernizado, nao liberado.
- Nao foram gerados binarios assinados de loja nem executados testes em
  dispositivos fisicos.

Esses itens nao regressaram nesta fase; foram confirmados pela revisao
independente e impedem transformar a modernizacao em liberacao de produto.

## Validacoes locais

```powershell
pnpm --dir octaclin-mobile install --frozen-lockfile
pnpm --dir octaclin-mobile typecheck
pnpm --dir octaclin-mobile doctor
pnpm --dir octaclin-mobile test:security
pnpm --dir octaclin-mobile audit:security
pnpm --dir octaclin-mobile build:validate
pnpm --dir octaclin-mobile exec expo install --check
pnpm --dir octaclin-mobile exec expo config --type introspect --json
```

Resultados: TypeScript aprovado, Expo Doctor aprovado, dependencias alinhadas,
6 testes de seguranca aprovados, somente as duas excecoes upstream esperadas e
bundles Android/iOS/web gerados com sucesso. A introspeccao nativa confirmou
ausencia de servicos de audio em segundo plano.

Nao houve migration, alteracao de producao, ativacao de flag ou distribuicao do
app.

## Decisao

A modernizacao tecnica da Fase 243 esta concluida. O app Mobile continua fora
da oferta e recebe veredito **NO-GO para distribuicao**. A divida upstream e os
PRs superados sao reconciliados no mesmo ciclo; os gates funcionais e de dados
ficam registrados para uma futura retomada explicita do produto Mobile.

Os PRs `#22`, `#24`, `#25`, `#29` e `#30` receberam referencia ao substituto e
foram encerrados depois do CI verde e do merge do PR `#84`.

## Proxima fase recomendada

- Fase 248 - Estados e recuperacao das superficies clinicas.
- Modelo: GPT-5.6 Sol, raciocinio `high`.
- Skills: `ecc:error-handling`, `ecc:frontend-patterns`,
  `ecc:frontend-a11y`, `ecc:e2e-testing` e
  `codex-engineering-guardrails:code-work`.
- Plugins: Chrome DevTools e Playwright.
