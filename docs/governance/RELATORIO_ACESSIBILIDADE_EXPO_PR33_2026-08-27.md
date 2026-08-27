# Relatorio de acessibilidade do aplicativo Expo - PR 33

Data da auditoria: 2026-08-27

## Objetivo

Auditar e corrigir a acessibilidade do aplicativo `octaclin-mobile` (Expo / React Native), separadamente da web,
e deixar uma regressao automatizada que rode no job `Mobile Expo` do CI.

Este PR nao substitui validacao com leitor de tela real. TalkBack e VoiceOver estao marcados como SKIPPED com
justificativa de ambiente na secao 9, e o roteiro manual reproduzivel esta nas secoes 10 e 11.

## 1. Versoes e ferramentas (obtidas nesta rodada)

| Item | Versao |
| --- | --- |
| expo | 57.0.15 |
| react-native | 0.86.2 |
| react | 19.2.3 |
| expo-router | 57.0.15 |
| expo-camera | 57.0.4 |
| expo-audio | 57.0.4 |
| expo-sqlite | 57.0.1 |
| react-native-web | 0.21.2 |
| @expo/vector-icons | 15.1.1 |
| typescript | 7.0.2 |
| expo-doctor | 1.20.2 |
| Node | v24.18.0 |
| pnpm | 9.15.9 |
| Chromium (evidencia de arvore renderizada) | 151.0.0.0 |
| Sistema | Windows 11 Pro 10.0.26200 |

`node_modules` local estava desatualizado (React Native 0.76.9, TypeScript 5.9.3). `pnpm install --frozen-lockfile`
alinhou o ambiente ao lockfile versionado antes de qualquer medicao. O lockfile nao foi alterado.

## 2. Inventario factual das telas

O aplicativo tem 6 arquivos de rota/componente com JSX, 488 linhas no total antes deste PR.

| Arquivo | Papel | Jornada |
| --- | --- | --- |
| `app/_layout.tsx` | Stack raiz, inicializa o banco local | infraestrutura |
| `app/index.tsx` | `Redirect` para `/(tabs)` | infraestrutura |
| `app/(tabs)/_layout.tsx` | Barra de 3 abas | navegacao |
| `app/(tabs)/index.tsx` | Diario rapido: agua, refeicao, humor, fila offline, sincronizacao | diario + offline/sincronizacao |
| `app/(tabs)/captura.tsx` | Captura multimodal: camera, video 30s, audio 2min | check-in multimodal |
| `app/(tabs)/acompanhante.tsx` | Cadastro de acompanhante com nome e PIN | formulario / acesso assistido |
| `components/botao-acao.tsx` | Botao de acao com icone, titulo e detalhe | compartilhado |
| `components/cartao-resumo.tsx` | Cartao de metrica (titulo + valor + icone) | compartilhado |

Fora do JSX: `lib/api.ts` (sincronizacao em lote), `lib/banco-local.ts` (SQLite offline), `lib/tema.ts` (paleta).

### Jornadas pedidas que nao existem no mobile

As jornadas do enunciado foram confrontadas com o codigo, nao presumidas:

| Jornada pedida | Existe no `octaclin-mobile`? |
| --- | --- |
| Autenticacao ou ativacao | **Nao.** `lib/api.ts:25` usa o literal `'token-local-dev'`; nao ha tela de login nem fluxo de ativacao |
| Tela inicial | Sim — `app/(tabs)/index.tsx` (Diario rapido) |
| Agenda | **Nao.** Nenhuma rota, componente ou chamada de agenda |
| Check-ins | Parcial — `app/(tabs)/captura.tsx` e o check-in multimodal; nao ha historico nem lista de check-ins |
| Plano | **Nao** |
| Mensagens | **Nao** |
| Perfil ou privacidade | **Nao.** `app/(tabs)/acompanhante.tsx` cobre acesso assistido, nao perfil/privacidade |
| Offline e sincronizacao | Sim — fila SQLite em `lib/banco-local.ts` e envio em lote em `lib/api.ts` |

A matriz foi montada sobre o que existe. Nenhuma tela nova foi criada: isso seria mudanca de produto fora do
escopo autorizado deste PR.

## 3. Baseline antes de alterar o produto

Gate estatico de acessibilidade criado neste PR, executado contra o codigo **anterior** as correcoes:

```text
Auditoria estatica de acessibilidade reprovada: 35 problema(s).
```

Distribuicao dos 35 problemas do baseline:

| Categoria | Ocorrencias |
| --- | --- |
| `Ionicons` direto na arvore de acessibilidade | 12 |
| `Pressable` sem `accessibilityRole` | 4 |
| `Pressable` sem `accessibilityLabel` | 4 |
| Tela sem `accessibilityRole="header"` | 3 |
| `TextInput` sem `accessibilityLabel` | 2 |
| Cor de limite de controle ausente na paleta | 2 |
| Estilo com `height` fixo (corta com fonte ampliada) | 2 |
| `CameraView` sem `accessibilityLabel` | 1 |
| `disabled` sem `accessibilityState` | 1 |

Confere com o gap analysis de 2026-08-25 (secao 2.3): busca por `accessibilityLabel`, `accessibilityRole`,
`accessible=` e `accessibilityHint` no mobile retornava **0 ocorrencias**. Nao era cobertura parcial, era ausencia
total da camada de acessibilidade nativa.

Baseline das validacoes do pacote, antes das mudancas: `typecheck` PASS, `doctor` PASS (exit 0),
`test:security` PASS 6/6, `audit:security` PASS com as duas excecoes upstream conhecidas de `image-size`,
`build:validate` PASS.

## 4. Matriz por jornada, plataforma e estado

`E` = estatico (codigo-fonte, gate `test:a11y`). `W` = arvore renderizada real no alvo web (react-native-web em
Chromium 151). `TB` = TalkBack. `VO` = VoiceOver.

| Jornada | Estado | E | W | TB | VO |
| --- | --- | --- | --- | --- | --- |
| Navegacao por abas | 3 abas, ativa e inativas | PASS | PASS | SKIPPED | SKIPPED |
| Navegacao por abas | tela inativa fora da arvore | NA | PASS | SKIPPED | SKIPPED |
| Diario rapido | inicial (0 pendentes) | PASS | PASS | SKIPPED | SKIPPED |
| Diario rapido | registro concluido | PASS | NA (1) | SKIPPED | SKIPPED |
| Diario rapido | falha ao gravar no aparelho | PASS | PASS | SKIPPED | SKIPPED |
| Diario rapido | sincronizando | PASS | NA (1) | SKIPPED | SKIPPED |
| Diario rapido | sincronizacao concluida / parcial / falha | PASS | NA (1) | SKIPPED | SKIPPED |
| Captura | camera indisponivel (sem permissao) | PASS | PASS | SKIPPED | SKIPPED |
| Captura | camera liberada (preview ativo) | PASS | NA (2) | SKIPPED | SKIPPED |
| Captura | audio parado / gravando | PASS | PASS | SKIPPED | SKIPPED |
| Acompanhante | formulario vazio (botao indisponivel) | PASS | PASS | SKIPPED | SKIPPED |
| Acompanhante | formulario completo (botao liberado) | PASS | PASS | SKIPPED | SKIPPED |
| Acompanhante | falha ao salvar | PASS | NA (1) | SKIPPED | SKIPPED |
| Todas | contraste da paleta | PASS | NA | NA | NA |
| Todas | alvo de toque >= 44 pt | PASS | NA | SKIPPED | SKIPPED |
| Todas | reducao de movimento | NA (3) | NA (3) | NA (3) | NA (3) |
| Todas | modais e retorno de foco | NA (4) | NA (4) | SKIPPED | SKIPPED |
| Todas | imagens clinicas | NA (5) | NA (5) | NA (5) | NA (5) |

(1) No alvo web o `expo-sqlite` roda sobre OPFS e o handle sincronizado fica preso entre recargas
(`NoModificationAllowedError`), entao os estados de sucesso da fila nao foram alcancaveis nesse alvo. O estado de
falha foi alcancado e verificado justamente por isso.
(2) O navegador nao concedeu permissao de camera na sessao; o estado renderizado foi o de indisponibilidade.
(3) O aplicativo nao usa `Animated`, `LayoutAnimation` nem `react-native-reanimated`. Nao ha movimento a reduzir.
Verificado por busca em `app`, `components` e `lib`: 0 ocorrencias.
(4) Nao ha `Modal` no aplicativo. Os unicos dialogos sao `Alert.alert`, dialogos nativos da plataforma, que ja
gerenciam foco e anuncio.
(5) O aplicativo nao renderiza nenhuma imagem clinica nem `Image`. Ha somente icones de fonte, todos decorativos.

## 5. Problemas comprovados e correcoes

### 5.1 Icones de fonte poluem a arvore de acessibilidade

**Evidencia.** `@expo/vector-icons` 15.1.1 renderiza o icone como
`<Text selectable={false} {...props}>{glifo}</Text>`
(`build/vendor/react-native-vector-icons/lib/create-icon-set.js:62`), sem nenhum tratamento de acessibilidade. O
glifo e um caractere de area de uso privado. Sozinho, o icone vira um no focavel sem nome; dentro de um controle,
o glifo entra no nome acessivel anunciado. Havia 12 usos diretos.

**Correcao.** `components/icone.tsx` novo, com `IconeDecorativo`. Todos os 12 usos passaram a usa-lo.

**Fato novo, verificado no DOM exportado.** `accessibilityElementsHidden` (iOS) e
`importantForAccessibility="no-hide-descendants"` (Android) **nao sao traduzidos pelo react-native-web**. Com so
essas duas props, `document.querySelectorAll('[aria-hidden="true"]').length` era **0** e o nome acessivel da aba
saia como `"  Diario"` (espacos dos nos de icone). Foi preciso acrescentar `aria-hidden`. Depois: **12
`aria-hidden`** na tela inicial, **14** apos abrir a segunda aba, e o nome da aba virou exatamente `"Diario"`.
O gate cobra as tres props.

### 5.2 Botoes sem papel e sem nome acessivel

**Evidencia.** `BotaoAcao` e os tres botoes de `captura.tsx` eram `Pressable` sem `accessibilityRole` nem
`accessibilityLabel`. Sem papel, o leitor de tela nao anuncia "botao"; com o texto vindo dos filhos, o glifo do
icone entrava no nome.

**Correcao.** `accessibilityRole="button"` e `accessibilityLabel` explicitos. Onde o texto de apoio acrescenta
informacao sobre o que a acao faz, virou `accessibilityHint` em vez de parte do nome.

**Depois (web).** `button aria-label="Registrar refeicao"`, `"Humor agora"`, `"Adicionar agua"`, `"Sincronizar"`,
`"Foto refeicao"`, `"Video 30s"`, `"Audio 2min"`, `"Salvar acompanhante"` — todos limpos, sem glifo.

### 5.3 Nenhuma tela expunha cabecalho

**Evidencia.** Nenhum `accessibilityRole="header"` no aplicativo. O titulo de cada tela era `Text` comum, entao a
navegacao por cabecalhos do TalkBack e do VoiceOver nao tinha onde parar.

**Correcao.** `accessibilityRole="header"` no titulo das tres telas.

**Depois (web).** `<h1 aria-level="1" role="heading">` com `Diario rapido`, `Captura` e `Modo acompanhante`.

### 5.4 Campos do formulario sem nome programatico

**Evidencia.** `acompanhante.tsx` tinha rotulos visuais (`Nome`, `PIN`) como `Text` solto. React Native nao tem
associacao equivalente a `label for`, entao os dois `TextInput` chegavam ao leitor de tela sem nome. A restricao
"4 a 6 digitos" existia so no `placeholder`, que some ao digitar.

**Correcao.** `accessibilityLabel` nos dois campos e `accessibilityHint="Use de 4 a 6 digitos"` no PIN.

**Depois (web).** `input aria-label="Nome do acompanhante"` e `input type="password"
aria-label="PIN de acesso do acompanhante"`.

### 5.5 Botao desabilitado sem estado anunciado e sem indicacao visivel

**Evidencia.** `<Pressable ... disabled={!nome || pin.length < 4}>` sem `accessibilityState`, sem mudanca visual e
sem texto explicando o que falta. O controle simplesmente nao respondia.

**Correcao.** `accessibilityState={{ disabled }}`, estilo `botaoIndisponivel` e um texto de ajuda em regiao live
que diz o que falta preencher. A informacao nao fica so na cor nem so na ausencia de resposta ao toque.

**Depois (web).** `button aria-label="Salvar acompanhante"` com `disabled=true`, e regiao
`aria-live="polite"` contendo `"Preencha o nome e um PIN de 4 a 6 digitos para liberar o botao."`

### 5.6 Mudanca de estado sem anuncio, e falha totalmente silenciosa

**Evidencia.** Registrar refeicao, humor ou agua so alterava o contador `Pendentes`, sem anuncio. `sincronizar()`
tinha `catch { setPendentes(...) }`: em caso de falha, nada mudava na tela e nada era anunciado. `registrar()` nao
tinha `catch` nenhum — uma falha de gravacao local ficava completamente invisivel.

Esse ultimo caso foi **reproduzido de verdade** no alvo web: com o handle OPFS do `expo-sqlite` preso
(`NoModificationAllowedError`), o toque em "Registrar refeicao" nao produzia efeito algum, nem visual nem
anunciado.

**Correcao.** Uma regiao de status unica em `index.tsx` (`accessibilityRole="alert"` +
`accessibilityLiveRegion="polite"`), montada mesmo vazia, cobrindo carregamento ("Sincronizando registros
pendentes."), sucesso, sucesso parcial e falha. `registrar()` ganhou `catch`. Como `accessibilityLiveRegion` so
vale para Android, o VoiceOver e coberto por `AccessibilityInfo.announceForAccessibility` sob
`Platform.OS === 'ios'`.

**Depois (web), mesma reproducao.** A regiao passou a conter
`"Nao foi possivel salvar o registro no aparelho. Tente novamente."` com `aria-live="polite"`.

`salvar()` em `acompanhante.tsx` recebeu o mesmo tratamento com `Alert.alert`, que ja e anunciado pelas duas
plataformas.

### 5.7 Preview da camera sem nome e estado de indisponibilidade fragmentado

**Evidencia.** `<CameraView>` sem `accessibilityLabel` — no focavel sem nome. O estado sem permissao era icone
mais texto, lidos como nos separados.

**Correcao.** `accessibilityLabel` na `CameraView`, variando por modo foto/video; estado sem permissao agrupado com
`accessible` e um rotulo unico.

**Depois (web).** `aria-label="Camera indisponivel. Permita a camera para registrar refeicoes e videos curtos."`

### 5.8 Cartoes de resumo lidos em pedacos

**Evidencia.** `CartaoResumo` produzia tres nos: titulo, glifo do icone e valor. O leitor de tela lia "Agua",
depois um no sem nome, depois "4 copos".

**Correcao.** `accessible` com `accessibilityLabel={`${titulo}: ${valor}`}`.

**Depois (web).** `generic "Agua: 4 copos"` e `generic "Pendentes: 0"`, um no cada.

### 5.9 Limite de campo e de botao abaixo de 3:1

**Evidencia.** Campos e botoes usavam `cores.linha` (`#D9DEE8`) como unica borda. Contra `#FFFFFF` isso da
**1.35:1**; contra `#F7F8FA`, **1.27:1**. WCAG 1.4.11 exige 3:1 para o limite que identifica um controle.

**Correcao.** Token novo `cores.contorno` (`#7A8390`): **3.83:1** sobre branco e **3.61:1** sobre o fundo. Aplicado
somente aos controles. `cores.linha` continua nos cartoes, que sao separacao decorativa e nao controles.

Os demais pares de texto ja passavam e foram fixados no gate: `tinta`/`branco` 14.68:1, `tinta`/`fundo` 13.81:1,
`textoSecundario`/`branco` 5.89:1, `textoSecundario`/`fundo` 5.55:1, `branco`/`primaria` 4.76:1.

### 5.10 Altura fixa corta texto com fonte ampliada

**Evidencia.** `acompanhante.tsx` tinha `input: { height: 48 }` e `botao: { height: 48 }`. Com `allowFontScaling`
ligado por padrao e fonte ampliada no sistema, o texto e cortado.

**Correcao.** `minHeight` no lugar de `height`, com `paddingVertical` para o conteudo crescer. Todos os alvos de
toque ficam em 48 pt ou mais (`BotaoAcao` 76, botoes de captura 58), acima dos 44 pt exigidos. O gate reprova
`height` fixo e `minHeight` abaixo de 44 em estilos de controle.

## 6. Verificacoes que passaram sem precisar de correcao

- **Ordem de foco.** Ordem do JSX igual a ordem visual em todas as telas; nao ha posicionamento absoluto nem
  reordenacao por estilo.
- **Tela inativa fora da arvore.** Com a aba Acompanhante ativa, o cabecalho `Diario rapido` continua no DOM, mas o
  container ancestral carrega `aria-hidden="true"` (posto pelo react-navigation). Nao ha leitura da tela inativa.
- **Informacao comunicada so por cor.** O botao de audio muda cor **e** icone **e** rotulo
  (`Audio 2min` / `Parar audio`); o botao desabilitado tem texto de ajuda alem da cor.
- **Alvos de toque.** Todos >= 48 pt apos a correcao 5.10.
- **Teclado externo.** Nao ha manipulador de tecla proprio; o comportamento e o padrao do React Native. Nada a
  corrigir, nada validado com hardware.

## 7. Regressao automatizada adicionada

`pnpm test:a11y` no pacote mobile, ligado ao job `Mobile Expo` do CI (`.github/workflows/ci.yml`), logo apos
`test:security`. Zero dependencia nova: `node --test`, no mesmo formato de `audit-seguranca-lib.mjs` +
`audit-seguranca.spec.mjs` ja usado no pacote.

- `scripts/auditoria-acessibilidade-lib.mjs` — funcoes puras: leitor de tags JSX que respeita aspas e chaves
  (para nao confundir `=>` com o fim da tag), regras por tag, checagem de alvo de toque e calculo de contraste WCAG.
- `scripts/auditoria-acessibilidade.mjs` — runner sobre `app/**` e `components/**` mais `lib/tema.ts`.
  Tambem disponivel como `pnpm audit:a11y`.
- `scripts/auditoria-acessibilidade.spec.mjs` — 11 testes unitarios das regras sobre entradas sinteticas mais
  1 teste de integracao que exige o projeto real aprovado.

Regras cobradas: papel e nome em `Pressable`; nome em `TextInput` e `CameraView`; `accessibilityState` sempre que
houver `disabled`; `Ionicons` proibido fora de `components/icone.tsx`; as tres props de ocultacao no icone
decorativo; `accessibilityRole="header"` em toda tela; sem `height` fixo e `minHeight` >= 44 em estilo de controle;
contraste minimo dos pares da paleta realmente usados.

**Limite declarado, nao escondido:** este gate le codigo-fonte. Ele impede regressao das correcoes comprovadas.
Ele **nao** valida o que o TalkBack ou o VoiceOver realmente falam, nem a compreensibilidade do anuncio, nem a
ordem de leitura percebida. A propria mensagem de aprovacao diz isso.

## 8. Validacoes executadas

| Resultado | Validacao | Evidencia |
| --- | --- | --- |
| PASS | `pnpm install --frozen-lockfile` | lockfile respeitado, sem alteracao |
| PASS | `pnpm typecheck` | exit 0 |
| PASS | `pnpm doctor` (Expo Doctor) | exit 0 (sem saida em shell nao interativo) |
| PASS | `pnpm test:security` | 6/6 |
| PASS | `pnpm test:a11y` (novo) | 12/12 |
| PASS | `pnpm audit:a11y` (novo) | 0 problemas; baseline eram 35 |
| PASS | `pnpm audit:security` | duas excecoes upstream conhecidas de `image-size`; distribuicao mobile segue bloqueada |
| PASS | `pnpm build:validate` | export android + ios + web concluido |
| PASS | `pnpm test:confiabilidade` (raiz) | 16 referencias criticas validas apos incluir a linha do gate novo na matriz |
| PASS | `git diff --check` | sem espaco em branco problematico |
| PASS | `pnpm security:secrets` (raiz) | nenhum secret identificado |
| PASS | Arvore de acessibilidade renderizada (web) | ver secao 5; Chromium 151 sobre `expo export` |
| SKIPPED | TalkBack em Android real ou emulador | ver secao 9 |
| SKIPPED | VoiceOver em iOS real ou simulador | ver secao 9 |
| SKIPPED | Fonte ampliada e reducao de movimento no sistema operacional | exigem dispositivo; a correcao de `minHeight` foi verificada so no codigo |
| NA | `lint` | o pacote `octaclin-mobile` nao define script de lint |
| NA | Testes de componente com renderizador RN | o pacote nao tem framework de teste de UI; adicionar um seria dependencia nova fora do escopo |
| NA | Migrations, backend, RLS, tenancy, producao, gate web | nao tocados |

## 9. Por que TalkBack e VoiceOver estao SKIPPED

Ambiente auditado nesta rodada:

```text
adb        = AUSENTE
emulator   = AUSENTE
sdkmanager = AUSENTE
java       = AUSENTE
ANDROID_HOME     = (vazio)
ANDROID_SDK_ROOT = (vazio)
%LOCALAPPDATA%\Android\Sdk existe: False
Sistema: Microsoft Windows NT 10.0.26200.0
```

Nao ha Android SDK, emulador, JDK nem dispositivo fisico. iOS e VoiceOver exigem macOS, indisponivel por
construcao neste host. Portanto **nao ha PASS de leitor de tela neste PR**, e nenhuma evidencia foi simulada.

A evidencia de arvore renderizada da secao 5 foi obtida no alvo web (react-native-web sobre o proprio
`expo export` do pacote). Ela comprova que as props chegam a arvore de acessibilidade e com que valores, mas **nao
e** TalkBack nem VoiceOver: o mapeamento e outro, como o proprio achado 5.1 demonstra.

## 10. Roteiro manual de TalkBack (Android)

Pre-requisitos: Android 13+, `pnpm --dir octaclin-mobile start` com o app aberto no dispositivo, TalkBack ligado em
Acessibilidade, e o registro de fala ativado (`adb logcat -s TalkBack` ou o historico de fala do TalkBack) para
preservar a evidencia. Use somente dados sinteticos: nome `Acompanhante Teste`, PIN `4321`.

1. **Abas.** Deslize ate a barra inferior. Confirme que cada aba anuncia exatamente `Diario`, `Captura`,
   `Acompanhante`, seguido do papel de guia e do estado selecionado. Nao deve haver caractere estranho nem no sem
   nome antes do rotulo.
2. **Cabecalho.** Com o leitor no modo de navegacao por cabecalhos, confirme que existe exatamente um cabecalho por
   tela e que ele e o titulo (`Diario rapido`, `Captura`, `Modo acompanhante`).
3. **Cartoes de resumo.** Deslize pelos dois cartoes. Cada um deve ser **um** no, anunciado como
   `Agua: N copos` e `Pendentes: N`. Se ouvir titulo e valor separados, ou um no sem nome entre eles, e regressao.
4. **Botoes do diario.** Deslize pelos quatro botoes. Cada um deve anunciar nome, papel `botao` e, na dica, o texto
   de apoio (por exemplo `Registrar refeicao, botao, Foto ou texto em poucos segundos`).
5. **Anuncio de registro.** Ative `Adicionar agua`. Sem mover o foco, o TalkBack deve anunciar a mensagem de status
   com a contagem de pendentes. Repita com `Registrar refeicao`.
6. **Anuncio de sincronizacao.** Ative `Sincronizar` com o aparelho em modo aviao. Deve anunciar primeiro
   `Sincronizando registros pendentes.` e depois a mensagem de falha, sem que o foco se mova.
7. **Captura sem permissao.** Abra `Captura` antes de conceder a camera. O bloco deve ser um no unico anunciando
   `Camera indisponivel. Permita a camera...`.
8. **Captura com permissao.** Conceda a camera. O preview deve anunciar
   `Pre-visualizacao da camera traseira em modo foto`.
9. **Audio.** Ative `Audio 2min`. Confirme que o rotulo passa a `Parar audio` e que o estado selecionado e
   anunciado. Ative de novo e confirme o dialogo `Audio salvo`.
10. **Formulario.** Em `Acompanhante`, deslize pelos campos. Devem anunciar
    `Nome do acompanhante, caixa de edicao` e `PIN de acesso do acompanhante, caixa de edicao, protegido`, com a
    dica `Use de 4 a 6 digitos` no PIN.
11. **Botao indisponivel.** Com o formulario vazio, o botao deve anunciar `Salvar acompanhante, botao,
    desativado`, e o texto de ajuda deve ser anunciado como regiao live ao mudar. Preencha nome e PIN e confirme
    que o estado desativado deixa de ser anunciado.
12. **Ordem de foco.** Percorra cada tela inteira so com deslizes para a direita. A ordem ouvida deve ser a ordem
    visual, de cima para baixo, sem voltar a itens da tela anterior.
13. **Fonte ampliada.** Com Tamanho da fonte no maximo, confirme que nenhum rotulo de campo ou de botao fica
    cortado ou sobreposto.

## 11. Roteiro manual de VoiceOver (iOS)

Pre-requisitos: macOS com Xcode, iOS 17+, `pnpm --dir octaclin-mobile start` com o app no dispositivo ou
simulador, VoiceOver ligado e o Rotor disponivel. Mesmos dados sinteticos.

1. Repita os passos 1 a 4, 7 a 10, 12 e 13 do roteiro de TalkBack. Os nomes acessiveis sao os mesmos.
2. **Cabecalhos pelo Rotor.** Ajuste o Rotor para `Titulos` e deslize para baixo. Deve haver exatamente um titulo
   por tela.
3. **Anuncio de registro e de sincronizacao.** No iOS as mensagens vem de
   `AccessibilityInfo.announceForAccessibility`, nao da regiao live. Ative `Adicionar agua` e depois `Sincronizar`
   em modo aviao e confirme que a mensagem e falada sem mover o foco. **Este e o caminho de codigo especifico do
   iOS; se algum anuncio faltar, o defeito esta aqui e nao no Android.**
4. **Icones.** Confirme que nenhum icone e alcancado pelo foco e que nenhum nome de botao ou de aba contem
   caractere desconhecido — e o efeito de `accessibilityElementsHidden`.
5. **Botao indisponivel.** Confirme que o VoiceOver anuncia `esmaecido` ou `indisponivel` no botao
   `Salvar acompanhante` com o formulario vazio.
6. **Dialogos.** Confirme que `Alert.alert` recebe foco ao abrir e o devolve ao elemento anterior ao fechar.

## 12. Riscos residuais

- **Nenhum leitor de tela real foi executado.** O gate estatico e a arvore web indicam que as props existem e com
  que valores; nenhum dos dois prova o que TalkBack e VoiceOver falam. Ate o roteiro das secoes 10 e 11 rodar em
  hardware, a acessibilidade do mobile continua **nao validada** para as duas plataformas alvo.
- **O caminho de anuncio do iOS nao foi exercido.** `AccessibilityInfo.announceForAccessibility` esta sob
  `Platform.OS === 'ios'` e nao roda no alvo web. E o ponto mais provavel de falha na primeira validacao real.
- **`accessibilityHint` nao chega ao alvo web.** O `TextInput` do PIN nao produziu `aria-describedby` em
  react-native-web. Em iOS e Android a dica e anunciada. No web a restricao continua visivel no texto de ajuda,
  entao a informacao nao se perde, mas o alvo web nao replica a dica.
- **O gate le codigo, nao comportamento.** Alguem pode satisfazer as regras com um rotulo ruim. Rotulo vago,
  excessivo ou duplicado e julgamento humano e nao esta coberto.
- **Contraste e verificado na paleta, nao no pixel.** Sobreposicoes com transparencia — como o fundo do icone em
  `BotaoAcao`, que usa a cor com alfa `22` — nao entram no calculo. Sao decorativas e redundantes com o texto, mas
  nao ha medicao de tela.
- **Fonte ampliada e reducao de movimento** nao foram exercidas em sistema operacional real. A correcao de
  `minHeight` reduz o risco de corte; nao o elimina em toda combinacao de idioma e escala.
- **`expo-sqlite` no alvo web** prende o handle OPFS entre recargas. Nao afeta iOS nem Android e nao foi corrigido:
  esta fora do escopo deste PR. Foi o que permitiu reproduzir o estado de falha da secao 5.6.

## 13. Fora de escopo

Nao foram alterados: frontend Next.js, backend, `octaclin-ai-service`, migrations, producao, gate web de
acessibilidade, integracoes externas, o lockfile do mobile e a decisao de NO-GO para distribuicao mobile.

Nao foram criadas telas novas. As jornadas listadas na secao 2 que nao existem no aplicativo continuam nao
existindo: cria-las seria mudanca de produto, nao acessibilidade.

Nenhuma dependencia nova foi instalada. Nenhum dado real, PHI, PII, token ou credencial foi usado; os unicos dados
que aparecem sao sinteticos e ja estavam no codigo (`paciente-local`, `token-local-dev`).

Fora do pacote `octaclin-mobile` ha exatamente duas alteracoes, ambas de registro do gate novo: uma linha em
`.github/workflows/ci.yml`, dentro do job `Mobile Expo`, e uma linha na tabela de
`MATRIZ_CONFIABILIDADE_TESTES.md`, exigida por `AGENTS.md` quando risco ou teste muda. O job `web` nao foi tocado.
Mais o proprio relatorio, em `docs/governance/`.
