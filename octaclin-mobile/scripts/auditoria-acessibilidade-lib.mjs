// Auditoria estatica de acessibilidade do aplicativo Expo.
//
// Escopo: verifica no codigo-fonte as propriedades de acessibilidade que
// TalkBack e VoiceOver consomem. NAO substitui teste com leitor de tela real;
// ela impede regressao das correcoes ja comprovadas.

const NIVEL_TEXTO = 4.5;
const NIVEL_COMPONENTE = 3;
const ALVO_TOQUE_MINIMO = 44;

const REGRAS_TAG = new Map([
  ['Pressable', ['accessibilityRole', 'accessibilityLabel']],
  ['TextInput', ['accessibilityLabel']],
  ['CameraView', ['accessibilityLabel']],
]);

// Ionicons renderiza <Text> com um glifo de area de uso privado e nao trata
// acessibilidade (create-icon-set.js). Usado direto, ele entra na arvore e
// polui o nome acessivel do controle que o contem.
const ARQUIVO_ICONE_PERMITIDO = 'components/icone.tsx';

const PREFIXOS_ALVO_TOQUE = /^(botao|input|campo|toque|acao)/i;

const PARES_CONTRASTE = [
  { frente: 'tinta', fundo: 'branco', minimo: NIVEL_TEXTO, uso: 'texto principal sobre cartao' },
  { frente: 'tinta', fundo: 'fundo', minimo: NIVEL_TEXTO, uso: 'texto principal sobre a tela' },
  { frente: 'textoSecundario', fundo: 'branco', minimo: NIVEL_TEXTO, uso: 'texto secundario sobre cartao' },
  { frente: 'textoSecundario', fundo: 'fundo', minimo: NIVEL_TEXTO, uso: 'texto secundario sobre a tela' },
  { frente: 'branco', fundo: 'primaria', minimo: NIVEL_TEXTO, uso: 'texto do botao primario' },
  { frente: 'contorno', fundo: 'branco', minimo: NIVEL_COMPONENTE, uso: 'limite de campo e botao sobre cartao' },
  { frente: 'contorno', fundo: 'fundo', minimo: NIVEL_COMPONENTE, uso: 'limite de campo e botao sobre a tela' },
];

function luminancia(hex) {
  const canais = [1, 3, 5]
    .map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map((valor) => (valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

export function razaoContraste(hexA, hexB) {
  const [claro, escuro] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (claro + 0.05) / (escuro + 0.05);
}

export function extrairPaleta(fonte) {
  const paleta = {};
  for (const [, nome, valor] of fonte.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
    paleta[nome] = valor;
  }
  return paleta;
}

export function avaliarContraste(paleta) {
  const problemas = [];
  for (const par of PARES_CONTRASTE) {
    const frente = paleta[par.frente];
    const fundo = paleta[par.fundo];
    if (!frente || !fundo) {
      problemas.push(`lib/tema.ts: cor ausente para o par ${par.frente}/${par.fundo} (${par.uso}).`);
      continue;
    }
    const razao = razaoContraste(frente, fundo);
    if (razao < par.minimo) {
      problemas.push(
        `lib/tema.ts: contraste ${par.frente}/${par.fundo} = ${razao.toFixed(2)}:1, abaixo de ${par.minimo}:1 (${par.uso}).`,
      );
    }
  }
  return problemas;
}

// Le as tags JSX abertas respeitando aspas e chaves, para que `=>` dentro de
// um atributo nao seja confundido com o fim da tag.
export function extrairTags(fonte) {
  const tags = [];
  const inicio = /<([A-Z][A-Za-z0-9_.]*)/g;
  let encontrado;

  while ((encontrado = inicio.exec(fonte))) {
    let posicao = inicio.lastIndex;
    let profundidade = 0;
    let aspas = null;

    while (posicao < fonte.length) {
      const caractere = fonte[posicao];
      if (aspas) {
        if (caractere === aspas) aspas = null;
      } else if (caractere === '"' || caractere === "'" || caractere === '`') {
        aspas = caractere;
      } else if (caractere === '{') {
        profundidade += 1;
      } else if (caractere === '}') {
        profundidade -= 1;
      } else if (caractere === '>' && profundidade === 0) {
        break;
      }
      posicao += 1;
    }

    tags.push({
      nome: encontrado[1],
      atributos: fonte.slice(inicio.lastIndex, posicao),
      linha: fonte.slice(0, encontrado.index).split('\n').length,
    });
  }

  return tags;
}

// Um literal por atributo auditado, em vez de montar a expressao com o nome.
// Cada padrao exige inicio ou espaco antes do nome e `=`, espaco, `/` final ou
// fim depois dele, para que um prefixo comum (`accessibilityLabel` dentro de
// `accessibilityLabelledBy`) nao conte como presenca.
const PADROES_ATRIBUTOS = new Map([
  ['accessibilityRole', /(^|\s)accessibilityRole\s*(=|\/?$|\s)/],
  ['accessibilityLabel', /(^|\s)accessibilityLabel\s*(=|\/?$|\s)/],
  ['accessibilityState', /(^|\s)accessibilityState\s*(=|\/?$|\s)/],
  ['accessibilityElementsHidden', /(^|\s)accessibilityElementsHidden\s*(=|\/?$|\s)/],
  ['importantForAccessibility', /(^|\s)importantForAccessibility\s*(=|\/?$|\s)/],
  ['aria-hidden', /(^|\s)aria-hidden\s*(=|\/?$|\s)/],
  ['disabled', /(^|\s)disabled\s*(=|\/?$|\s)/],
]);

// Fail-closed: um atributo novo em REGRAS_TAG sem padrao aqui derruba a
// auditoria em vez de passar como se a prop estivesse presente.
export function temAtributo(atributos, nome) {
  const padrao = PADROES_ATRIBUTOS.get(nome);
  if (!padrao) throw new Error(`Atributo nao suportado pela auditoria: ${nome}`);
  return padrao.test(atributos);
}

export function extrairEstilos(fonte) {
  const bloco = fonte.match(/StyleSheet\.create\(\{([\s\S]*)\}\);?\s*$/);
  if (!bloco) return {};

  const estilos = {};
  for (const [, nome, corpo] of bloco[1].matchAll(/(\w+):\s*\{([^{}]*)\}/g)) {
    estilos[nome] = corpo;
  }
  return estilos;
}

function avaliarAlvosDeToque(caminho, fonte) {
  const problemas = [];
  for (const [nome, corpo] of Object.entries(extrairEstilos(fonte))) {
    if (!PREFIXOS_ALVO_TOQUE.test(nome)) continue;

    const alturaFixa = corpo.match(/(^|[^n])\bheight:\s*(\d+)/);
    if (alturaFixa) {
      problemas.push(
        `${caminho}: estilo "${nome}" usa height fixo (${alturaFixa[2]}). Use minHeight para nao cortar texto com fonte ampliada.`,
      );
      continue;
    }

    const alturaMinima = corpo.match(/\bminHeight:\s*(\d+)/);
    if (alturaMinima && Number(alturaMinima[1]) < ALVO_TOQUE_MINIMO) {
      problemas.push(
        `${caminho}: estilo "${nome}" tem minHeight ${alturaMinima[1]}, abaixo do alvo de toque de ${ALVO_TOQUE_MINIMO}.`,
      );
    }
  }
  return problemas;
}

export function analisarFonte(caminho, fonte) {
  const problemas = [];

  for (const tag of extrairTags(fonte)) {
    if (tag.nome === 'Ionicons' && caminho !== ARQUIVO_ICONE_PERMITIDO) {
      problemas.push(
        `${caminho}:${tag.linha}: use IconeDecorativo em vez de Ionicons direto. O glifo entra na arvore de acessibilidade.`,
      );
    }

    // iOS, Android e web precisam de props diferentes para o mesmo efeito.
    if (tag.nome === 'Ionicons' && caminho === ARQUIVO_ICONE_PERMITIDO) {
      for (const atributo of ['accessibilityElementsHidden', 'importantForAccessibility', 'aria-hidden']) {
        if (!temAtributo(tag.atributos, atributo)) {
          problemas.push(`${caminho}:${tag.linha}: icone decorativo sem ${atributo}.`);
        }
      }
    }

    for (const atributo of REGRAS_TAG.get(tag.nome) ?? []) {
      if (!temAtributo(tag.atributos, atributo)) {
        problemas.push(`${caminho}:${tag.linha}: <${tag.nome}> sem ${atributo}.`);
      }
    }

    if (temAtributo(tag.atributos, 'disabled') && !temAtributo(tag.atributos, 'accessibilityState')) {
      problemas.push(
        `${caminho}:${tag.linha}: <${tag.nome}> tem disabled sem accessibilityState. O leitor de tela nao anuncia o estado.`,
      );
    }
  }

  if (caminho.startsWith('app/') && !caminho.endsWith('_layout.tsx') && !caminho.endsWith('app/index.tsx')) {
    if (!/accessibilityRole=["']header["']/.test(fonte)) {
      problemas.push(`${caminho}: nenhum accessibilityRole="header". A tela nao expoe titulo navegavel por cabecalho.`);
    }
  }

  problemas.push(...avaliarAlvosDeToque(caminho, fonte));

  return problemas;
}

export function avaliarProjeto(arquivos, temaFonte) {
  const problemas = [
    ...avaliarContraste(extrairPaleta(temaFonte)),
    ...arquivos.flatMap(({ caminho, fonte }) => analisarFonte(caminho, fonte)),
  ];

  return {
    aprovado: problemas.length === 0,
    problemas,
    mensagem: problemas.length === 0
      ? 'Auditoria estatica de acessibilidade aprovada. Nao substitui validacao com TalkBack ou VoiceOver.'
      : `Auditoria estatica de acessibilidade reprovada: ${problemas.length} problema(s).`,
  };
}
