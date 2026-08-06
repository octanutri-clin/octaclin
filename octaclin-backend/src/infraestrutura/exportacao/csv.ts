/**
 * CSV do produto: montagem (exportacoes) e leitura (importacoes).
 *
 * Existia um mecanismo por modulo — `campoCsv` em `servico-usuarios-cliente` e
 * `montarCsv`/`escaparCsv` em `servico-operacoes` — com regras diferentes de
 * citacao e de newline final. Este modulo consolida os dois; nao criar um
 * terceiro.
 */

/** Caracteres que fazem a planilha tratar a celula como formula. */
const INICIO_DE_FORMULA = /^[=+@\t\r-]/;

function ehNumero(valor: string): boolean {
  return valor.trim() !== '' && Number.isFinite(Number(valor));
}

/**
 * Escapa uma celula.
 *
 * Alem da citacao normal de CSV, neutraliza injecao de formula: nome de paciente
 * e observacao vem de input do usuario e vao parar numa planilha, entao um campo
 * comecando com `=`, `+`, `@` ou tab e executado pelo Excel/Sheets quando a
 * clinica abre o arquivo. O apostrofo a frente e a mitigacao padrao (OWASP).
 *
 * Numero negativo escapa da regra do hifen de proposito: `-50` e dado, nao
 * formula, e prefixa-lo quebraria qualquer coluna numerica.
 */
export function campoCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  const neutralizado = INICIO_DE_FORMULA.test(texto) && !ehNumero(texto) ? `'${texto}` : texto;

  const precisaCitar =
    neutralizado !== texto || /[",\n\r\t]/.test(neutralizado) || neutralizado.trim() !== neutralizado;

  return precisaCitar ? `"${neutralizado.replace(/"/g, '""')}"` : neutralizado;
}

export function montarCsv(cabecalho: readonly string[], linhas: readonly unknown[][]): string {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(','));
  return `${conteudo.join('\n')}\n`;
}

export interface LinhaCsv {
  /** Numero da linha no arquivo original, com o cabecalho sendo 1. */
  numero: number;
  campos: string[];
}

export interface CsvAnalisado {
  cabecalho: string[];
  linhas: LinhaCsv[];
}

const SEPARADORES = [',', ';', '\t'] as const;

/**
 * Escolhe o separador contando ocorrencias fora de aspas na primeira linha.
 * Planilha em pt-BR exporta com `;` e planilha colada como texto vem com tab.
 */
function detectarSeparador(conteudo: string): string {
  const primeiraLinha = conteudo.split('\n', 1)[0] ?? '';
  let dentroDeAspas = false;
  const contagem = new Map<string, number>(SEPARADORES.map((separador) => [separador, 0]));

  for (const caractere of primeiraLinha) {
    if (caractere === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas && contagem.has(caractere)) {
      contagem.set(caractere, (contagem.get(caractere) ?? 0) + 1);
    }
  }

  return SEPARADORES.reduce((melhor, atual) =>
    (contagem.get(atual) ?? 0) > (contagem.get(melhor) ?? 0) ? atual : melhor
  );
}

function normalizarCabecalho(campo: string): string {
  return campo
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/**
 * Le CSV sujo de verdade: BOM do Excel, CRLF, separador `,`/`;`/tab, campo
 * citado com separador e quebra de linha dentro, linhas em branco no meio.
 *
 * Nao valida nada e nao descarta linha com contagem de colunas errada — quem
 * importa precisa acusar a linha 47 pelo numero dela no arquivo, entao a linha
 * chega aqui como veio, com o numero original.
 */
export function analisarCsv(conteudo: string): CsvAnalisado {
  const texto = conteudo.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const separador = detectarSeparador(texto);

  const registros: LinhaCsv[] = [];
  let campos: string[] = [];
  let campoAtual = '';
  let citado = false;
  let citacaoUsada = false;
  let numeroLinha = 1;
  let numeroInicio = 1;

  const fecharCampo = () => {
    campos.push(citacaoUsada ? campoAtual : campoAtual.trim());
    campoAtual = '';
    citacaoUsada = false;
  };
  const fecharRegistro = () => {
    fecharCampo();
    if (campos.some((campo) => campo !== '')) registros.push({ numero: numeroInicio, campos });
    campos = [];
    numeroInicio = numeroLinha + 1;
  };

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice];

    if (citado) {
      if (caractere !== '"') {
        if (caractere === '\n') numeroLinha += 1;
        campoAtual += caractere;
      } else if (texto[indice + 1] === '"') {
        campoAtual += '"';
        indice += 1;
      } else {
        citado = false;
      }
      continue;
    }

    if (caractere === '"' && campoAtual.trim() === '') {
      campoAtual = '';
      citado = true;
      citacaoUsada = true;
    } else if (caractere === separador) {
      fecharCampo();
    } else if (caractere === '\n') {
      fecharRegistro();
      numeroLinha += 1;
    } else {
      campoAtual += caractere;
    }
  }
  if (campoAtual !== '' || campos.length) fecharRegistro();

  const cabecalho = registros.shift();
  return {
    cabecalho: cabecalho ? cabecalho.campos.map(normalizarCabecalho) : [],
    linhas: registros
  };
}
