# Fase 207 - Antropometria e evolucao de medidas

Status: concluida em 2026-08-05, em duas rodadas (backend em `baa8c34`,
frontend nesta). Era a maior fase do bloco C: o produto nao tinha peso, altura,
IMC, circunferencias, dobras nem composicao corporal, e o repositorio nao tinha
**nenhuma** biblioteca de grafico nem componente de grafico.

## Entregue

### Dominio (`pacientes/dominio/antropometria.ts`)

Cinco protocolos de composicao corporal, cada um com a referencia publicada no
comentario e o texto da equacao devolvido para ser gravado no registro:

- Jackson & Pollock 1978 (3 e 7 dobras, masculino)
- Jackson, Pollock & Ward 1980 (3 e 7 dobras, feminino)
- Faulkner 1968 (4 dobras, mesma equacao para ambos os sexos)
- Guedes 1985 (3 dobras, sitios diferentes por sexo)
- Siri 1961 para converter densidade corporal em percentual

Mais IMC com classificacao por faixa etaria, RCQ, circunferencia de cintura
isolada e comparacao entre avaliacoes.

**Sexo e idade sao entrada do calculo, nao consulta ao cadastro.** As equacoes
dependem dos dois, e a avaliacao precisa continuar reproduzivel se o cadastro
mudar depois. Ficam gravados como snapshot no proprio registro.

### Persistencia append-only

`avaliacoes_antropometricas` com RLS por tenant, CHECK de protocolo e sexo, e
indice parcial da serie temporal. O calculo acontece **uma vez, na gravacao**, e
o resultado vai criptografado junto do protocolo, da formula, do sexo e da
idade usados. Ler o historico nunca recalcula: teste prova que um registro
antigo com IMC 99,9 volta como esta, valor que o dominio de hoje recusaria.

Nao ha edicao, so nova avaliacao ou exclusao logica (`excluida_em`). Medida
corrigida em cima do registro deixaria de bater com a formula carimbada nele.

A `formula_aplicada` fica em claro: descreve o metodo, nao o paciente, e precisa
ser auditavel sem descriptografar nada.

### Grafico (`components/ui/grafico-evolucao.tsx`)

SVG inline, **zero dependencia nova**. Um componente, dois consumidores.

A skill `dataviz` foi carregada antes da primeira linha de codigo de grafico,
como o diagnostico exige, e mudou o desenho — ver a secao seguinte.

Especificacoes seguidas: linha de 2px, marcadores de 8px com anel de 2px na cor
da superficie, area a ~10% de opacidade, grade de 1px recessiva, rotulo direto
so no ultimo ponto, alvo de toque de 32px, tooltip no hover e no foco de
teclado, e alternativa em tabela sempre disponivel.

### Aba de antropometria no prontuario

Formulario que revela **apenas as dobras que o protocolo escolhido exige para o
sexo informado** — espelha `dobrasExigidas` do dominio, entao o profissional nao
digita dobra que nao vai ser usada nem esquece uma que vai. Lista de avaliacoes
com todos os derivados e a equacao usada em cada uma, comparacao com a anterior
e traducao dos avisos do dominio para texto de quem opera ("Falta a dobra Coxa",
nao `dobra_ausente:coxa`).

### Curva de peso no portal do paciente

So peso e data. Sem IMC, sem percentual de gordura, sem classificacao: o
paciente ve a propria curva, e a leitura clinica continua sendo da consulta.

## A escolha de grafico, e por que nao e multi-serie

O diagnostico proibia adotar biblioteca de grafico sem consultar `dataviz`
antes, e exigia que a paleta saisse dos tokens da Fase 202. Rodando o validador
da skill sobre os tokens:

```
node scripts/validate_palette.js "#247BA0,#2F9E44,#C77D1A,#C0392B" --mode light
  [FAIL] CVD separation   worst adjacent #C77D1A (alerta) <-> #2F9E44 (sucesso)
                          dE 4.7 (protan) - indistinguiveis
```

**A paleta categorica da Fase 202 reprova no teste de daltonismo.** Alem disso,
`sucesso`/`alerta`/`perigo` sao cores de status, reservadas para estado e nao
para identidade de serie.

Isso decidiu o desenho: **serie unica com seletor de metrica**, nao multi-serie.
Consequencias, todas boas:

- nao existe par de cores para o daltonico confundir;
- nao existe eixo duplo, que peso (kg) e percentual (%) exigiriam — e eixo duplo
  e o erro numero 1 de grafico;
- serie unica dispensa legenda: o titulo ja diz o que esta plotado.

Sobre a biblioteca: um grafico de linha de serie unica e ~200 linhas de SVG.
Nao entrou dependencia. Registrado aqui para nao ser reaberto sem motivo novo.

## Correcoes de revisao clinica (rodada de backend)

`ecc:healthcare-reviewer` conferiu os coeficientes e os sitios de dobra de todos
os protocolos contra as publicacoes originais: **todos corretos**. O risco que
motivou a revisao nao se materializou. Os problemas estavam nas bordas:

1. **Pollock invertia em obesidade grave** (critico). As equacoes sao
   quadraticas com vertice em ~258mm (Sigma3) e ~395mm (Sigma7). O codigo
   aceitava ate 300mm e 700mm: acima do vertice, mais gordura medida devolvia
   *menos* percentual, e o numero entrava no historico carimbado como
   "Jackson & Pollock 1978". Passa a recusar acima da faixa de validacao.
2. **Limiar "moderado" de RCQ inventado** (critico). Os valores 0,83/0,79 nao
   existem na OMS 2008, que e binaria — e estavam citados como se fossem dela.
   Categoria removida; a classificacao virou binaria como a fonte define.
3. IMC passa a classificar por faixa etaria: Lipschitz para 60+, criterio do
   SISVAN. Abaixo de 20 anos nao classifica.
4. Classificacao passou a usar o valor bruto: arredondar antes jogava a faixa
   [24,995; 25) inteira para sobrepeso, onde o corte mais importa.
5. Guarda de IMC fecha o par peso/altura, antes validado so isolado.
6. Avisos por sitio de dobra e por idade fora da amostra de validacao.

## Vazamento corrigido: score de risco no portal

O criterio de aceite pedia "paciente ve a curva de peso **sem ver score de
risco**", regra da Fase 161. Ao implementar, `scoreRisco` ja estava no payload
do portal do paciente (`ResumoPortalPaciente.paciente.scoreRisco`), chegando ao
navegador dele. Nenhum componente renderizava, mas o dado ia.

Removido dos dois pontos que montam o payload. O teste que existia afirmava
`scoreRisco: '12.50'` como esperado — codificava o vazamento como comportamento
correto. Foi invertido para `not.toHaveProperty('scoreRisco')` mais uma
verificacao de que a string nao aparece em lugar nenhum do payload serializado.

Consequencia registrada: a exportacao LGPD reusa `obterResumoPortal`, entao
tambem deixou de conter o score. E numero de triagem interna derivado, nao dado
fornecido pelo titular; se a decisao de produto for inclui-lo na exportacao, tem
de ser por um caminho proprio, com leitura junto.

## Nao feito

- **Escore-z de IMC para menores de 20 anos** (OMS 2007). Exige as tabelas LMS
  por idade e sexo, que sao um conjunto de dados, nao uma formula. Hoje o IMC e
  calculado e exibido, mas sai sem classificacao e com aviso explicito.
- **Balanca Wi-Fi / Health Connect / Apple Health.** O diagnostico pedia so
  preparar o modelo, e o modelo esta preparado: a avaliacao ja tem autor, data e
  origem implicita, e aceitar peso de dispositivo e adicionar uma origem ao
  registro. A integracao nao foi construida.
- **Dark mode no grafico.** `darkMode: ['class']` esta configurado no Tailwind,
  mas nao existe **nenhuma** classe `dark:` no repositorio inteiro — o produto e
  light-only hoje. Fazer o grafico sozinho ter dois temas seria a unica peca com
  dark mode. Entra quando o produto entrar.
- **Textura para o caso de daltonismo total / impressao.** Serie unica nao
  precisa: nao ha par de series para separar.
- **Grafico no dashboard clinico.** O diagnostico pedia prontuario e portal.

## Validacao local

- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-backend test --runInBand`: 515/515 aprovados
  (39 novos: 32 de dominio, 1 de migration, 6 de servico).
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado, rotas
  `/api/pacientes/[id]/avaliacoes-antropometricas` e
  `.../[avaliacaoId]` registradas.
- `playwright test` (suite completa): 138/138 aprovados, incluindo o teste novo
  "mostra a curva de peso sem numero clinico derivado junto" e o gate de
  acessibilidade com o grafico renderizado no portal.
