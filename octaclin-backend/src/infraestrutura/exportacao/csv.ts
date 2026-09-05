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

/**
 * Conta os registros de dado de um CSV ja montado, sem olhar o conteudo das
 * celulas.
 *
 * Existe para a auditoria das exportacoes (PR 52, fase 1c). O que permite
 * detectar exfiltracao e o *volume* levado, e volume e tambem a unica coisa
 * segura de gravar: copiar as linhas para dentro de `user_action_logs.metadados`
 * faria o registro do acesso conter o proprio dado acessado, transformando a
 * trilha na segunda copia do vazamento que ela deveria denunciar.
 *
 * Contar `\n` cru daria numero errado: `campoCsv` cita a celula que contem
 * quebra de linha, entao uma observacao multilinha inflaria a contagem e a
 * evidencia de volume deixaria de valer. O laco alterna o estado de citacao
 * para so contar quebra que de fato encerra registro.
 *
 * A funcao nao pressupoe a quebra final que `montarCsv` sempre escreve. Hoje os
 * call sites so alimentam saida de `montarCsv`, mas o repositorio ja usa
 * `csv.trim().split('\n')` em outros pontos, e um CSV trimado -- ou vindo de
 * qualquer outro produtor -- perderia o ultimo registro se a contagem dependesse
 * dessa quebra. Subcontar aqui e pior do que parece: `totalLinhas` e a evidencia
 * de volume de uma exportacao, e evidencia baixa demais deixa uma exfiltracao
 * parecer menor do que foi.
 */
export function contarLinhasCsv(csv: string): number {
  if (!csv) return 0;

  let registros = 0;
  let dentroDeAspas = false;
  // `true` quando ha conteudo depois da ultima quebra de registro, isto e,
  // quando o arquivo termina sem `\n` e o ultimo registro ainda precisa contar.
  let registroAberto = false;

  for (let indice = 0; indice < csv.length; indice += 1) {
    const caractere = csv[indice];

    if (caractere === '"') {
      // `""` e aspas escapada dentro do campo, e nao fim da citacao.
      if (dentroDeAspas && csv[indice + 1] === '"') indice += 1;
      else dentroDeAspas = !dentroDeAspas;
      registroAberto = true;
      continue;
    }

    if (caractere === '\n' && !dentroDeAspas) {
      registros += 1;
      registroAberto = false;
      continue;
    }

    registroAberto = true;
  }

  if (registroAberto) registros += 1;

  // Aspas que nunca fecha e bug do produtor: dai em diante o laco leu o resto do
  // arquivo como uma unica celula multilinha e devolveria um numero
  // absurdamente baixo -- zero, no caso comum de a aspas abrir na primeira
  // linha. Nao lancamos: o unico chamador e a auditoria de uma exportacao que ja
  // foi produzida e ja vai ser entregue, e a regra do repositorio e que
  // registrar o acesso nunca pode derrubar o acesso. Cair para a contagem de
  // linhas fisicas devolve o numero que o operador esperaria ver e nao esconde
  // volume, que e o que a trilha precisa provar.
  if (dentroDeAspas) registros = contarLinhasFisicas(csv);

  // A primeira linha e o cabecalho: um CSV so de cabecalho tem zero registros.
  return Math.max(registros - 1, 0);
}

function contarLinhasFisicas(csv: string): number {
  let linhas = 0;
  for (const caractere of csv) if (caractere === '\n') linhas += 1;
  return csv.endsWith('\n') ? linhas : linhas + 1;
}
