# FOOD06 — M04: núcleo factual e provas de receitas M02

## Estado e fronteiras

Mesma branch/PR #455 Draft, basea35a22dd. Na retomada: Backend, Web e scanners
PASS; PostgreSQL/RLS e concorrência do incremento fonte/ordem/origem PASS no CI
41287980436, job124793134129 (role runtime sem BYPASSRLS, suíte sem filtro e
Testcontainers). Demo ainda em execução; SBOM provenance SKIPPED. Não confundir
esse resultado com aprovação do novo delta nem com prontidão da FOOD06 inteira.

Novo runtime: somente `dominio/previa-dietetica.ts`, interno e sem chamador HTTP,
UI, gravação, banco, resolução de paciente ou registro de módulo novo. Reutiliza
PA06/cobertura e primitivas de escala8, sem segundo motor de composição.
Rollback de código, sem formato persistido/migration ou recálculo histórico.
Não inicia FOOD05-MDL/D18; direitos das referências e G06 seguem BLOCKED.

## Contrato M04 implementado

- Compara dois estados já resolvidos na mesma base factual. Contrato **interno**;
  nunca aceitar estes snapshots/totais/booleans como payload confiável do browser.
- Retorna antes/depois, macros/micros, contagens/causas e diferenças por código.
  Não atribui a diferença automaticamente à dieta, melhora clínica ou consumo.
- Diferença com sinal na unidade do nutriente. Usa totais PA06 já quantizados em
  escala8, não arredondamento da tela ou multiplicação de porção pela segunda vez.
- Percentual é mudança relativa ao estado anterior, **não** RDA/AI/UL, adequação ou
  confiança científica. Half-up simétrico para sinais e indicação de arredondamento.
- Base zero conserva diferença absoluta válida e informa percentual indisponível.
  Limite técnico só do percentual não apaga a diferença válida; omite percentual
  com motivo, sem NaN/Infinity/zero artificial ou expansão de limites.
- Cobertura incompleta/incompatível/não resolvida não produz delta aparentemente
  completo. Subtotais conhecidos antes/depois permanecem disponíveis; nutrientes
  independentes completos continuam calculáveis.
- Seleção/OFF, arrays esparsos, teto10.000 e overflow conservam a semântica PA06.
  Entradas e snapshots não são modificados; resultado de prévia não vira origem
  de outro cálculo. Nenhuma projeção de snapshot/contexto livre no retorno.
- Referências clínicas ficam explicitamente indisponíveis. O núcleo não resolve
  idade/população/dia/tabagismo, direitos ou referências, nem autoriza aplicação.

## Verificações de integração M02

Novos testes de regressão reaproveitam contratos existentes, sem alterar runtime
FOOD07 ou fabricar RED onde o comportamento já estava correto:

1. Receita inteira500g/rendimento4 e cadastro por porção125g, ambos1,5porções →
   187,5g. Writer real em fixture de repositório congela ferro3,75mg (2mg/100g),
   cálcio0 conhecido e selênio desconhecido. Porção não é multiplicada novamente.
2. Alternativa disponível, liberada e preferida com ferro900 não entra na soma.
   Flags são decisões de disponibilidade/preferência, não troca do plano ou prova
   de consumo. Receita original e persistência lida permanecem intactas.
3. Catálogo sintético de base10g/ferro2mg →37,5mg em187,5g. Fonte/preparo/base
   ficam congelados na publicação. Alterar/inativar fonte não reescreve fatos;
   nova versão editável recusa nova materialização pela fonte inativa, com erro
   específico, sem modificar o conteúdo da publicação consultada.
4. Duas novas provas PostgreSQL/RLS na suíte oficial: materialização das duas
   bases para1,5porções, totais/detalhe/zero/ausência, histórico cifrado intacto,
   negação cross-tenant. NOT RUN local; aguardam CI do delta.

O caso de troca explicitamente selecionada é demonstrado no núcleo M04 ao
substituir o principal no estado proposto, mantendo outros itens. Isso não cria
uma rota de aplicação, não lê preferências do paciente como ingestão e não
antecipa FOOD05: autorização/fontes/CAS/identidades da confirmação continuam
pendentes antes de habilitar o caminho integrado. M02 permanece parcial.

## TDD e resultados

- RED:15/15 funcionais do núcleo antes da implementação; erro de comando pelo
  diretório incorreto foi corrigido e não conta como RED. Node22.23.4.
- GREEN inicial188 em quatro suítes; após adversários/flags e catálogo193PASS.
- Backend completo:3854PASS/172SKIPPED,378suítesPASS/9SKIPPED. Dois skipped novos
  são as provas PostgreSQL de receitas; nenhum mock é evidência de RLS/rollback.
- Typecheck e build Nest/verificador de artefato backend PASS, Node22.23.4.
- Sem alteração Web/BFF: não repetir browser sem mudança relevante;38Playwright,
  76BFF/35Web do commit anterior são históricos daquele escopo, não testes novos
  deste núcleo. UX B/C N/A à entrega puramente interna; UX A da FOOD06 continua
  referência. Nova avaliação B/C obrigatória quando houver interface utilizável.
- R4 independente `/root/food06_m02_ui_r4`:166PASS próprios em três suítes,
  sem achado reproduzível. Prova matemática transitória:609pares (600 LCG com
  seed271828183 e9bordas) sobre totais PA06. Reutilizou decimalParaEscala8; não
  verifica independentemente esse conversor. Script/stdout não persistiram em
  arquivo; registro textual na atividade do revisor. Não é oráculo oficial,
  científico ou clínico, nem substituto dos testes versionados19casos.
- R4 limitada a código/matemática: sem execução própria de novo PG, browser,
  CI/provider, sem coautoria e sem parecer integral da FOOD06.

## Próxima integração obrigatória

1. API/BFF de prévia com comandos limitados por IDs estáveis, autorização atual
   tenant/paciente/carteira, publicação/rascunho e revisão exatos.
2. Resolver fontes/composições no servidor, construir os estados na transação
   existente e vincular a prévia a fingerprint/revisão. Não confiar em números
   calculados no browser ou usar posições de array como identidade de aplicação.
3. Confirmação explícita pelos writers atuais com CAS/posse PA07, reautorização,
   idempotência e rollback; prévia/cancelamento sem gravação clínica.
4. Interface antes/depois integrada aos fluxos de porção/alimento/receita/preparo,
   estados parciais e conflitos, UX B/C, desktop/mobile/teclado/axe e novas provas
   PostgreSQL/RLS de concorrência/revogação. Não habilitar antes desses gates.

FOOD06:29,2% administrativos (7parciais/5pendentes pelo método fixo),0/12 melhorias
integralmente encerradas. Não é percentual de esforço/código nem prontidão para
uso assistencial. Mantidos todos M01–M12 e os gates científicos/operacionais.

## Comandos realmente executados

A partir do pacote backend com Node22 no PATH: Jest `--runInBand`, tanto arquivos
focados `dominio/previa-dietetica.spec.ts`, `calculo-combinado.spec.ts`,
`cobertura-dietetica.spec.ts`, `aplicacao/servico-planos-alimentares.spec.ts` quanto
suíte completa; `tsc --noEmit`; `nest build` e verificador de artefato. Gates de
segredos/diff na raiz antes do push. Dependências locais reutilizadas, sem novo
pacote ou lockfile. Nenhuma chamada a Neon/Render, migration externa ou deploy.
