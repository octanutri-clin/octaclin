import { createHash } from 'crypto';
import { inflateRawSync } from 'zlib';

export const TACO_URL_ORIGEM =
  'https://www.nepa.unicamp.br/arquivo/uploads/taco-4a-edicao/taco-4a-edicao-2/';
export const TACO_ABA_ORIGEM = 'CMVCol taco3';

export interface AlimentoTaco {
  codigo: number;
  descricao: string;
  categoria: string;
  energiaKcal: number | null;
  proteinaG: number | null;
  lipideosG: number | null;
  carboidratoG: number | null;
  fibraG: number | null;
  sodioMg: number | null;
}

export interface CatalogoTaco {
  metadados: {
    versaoArtefato: string;
    fonte: {
      nome: string;
      instituicao: string;
      edicao: string;
      ano: number;
      aba: string;
      unidadeBase: string;
      urlArquivo: string;
      urlPublicacao: string;
      licenca: {
        tipo: string;
        texto: string;
        atribuicaoObrigatoria: string;
      };
    };
    arquivoOrigem: {
      sha256: string;
      tamanhoBytes: number;
    };
    transformacao: {
      traco: string;
      naoAplicavel: string;
      ausente: string;
      arredondamento: Record<string, string>;
    };
    contagem: {
      linhasPlanilha: number;
      linhasNaoAlimento: number;
      alimentosCandidatos: number;
      alimentosValidos: number;
      alimentosExcluidos: number;
      exclusoesPorMotivo: Record<string, number>;
    };
    exclusoes: Array<{
      codigo: number;
      descricao: string;
      motivo: string;
    }>;
    sha256Alimentos: string;
  };
  alimentos: AlimentoTaco[];
}

interface EntradaZip {
  metodo: number;
  tamanhoComprimido: number;
  offsetCabecalhoLocal: number;
}

interface CelulaPlanilha {
  tipo: string;
  valor: string;
}

interface LinhaPlanilha {
  numero: number;
  celulas: Map<string, CelulaPlanilha>;
}

const CAMPOS_NUTRICIONAIS = [
  ['D', 'energiaKcal', 0],
  ['F', 'proteinaG', 1],
  ['G', 'lipideosG', 1],
  ['I', 'carboidratoG', 1],
  ['J', 'fibraG', 1],
  ['R', 'sodioMg', 0]
] as const;

function sha256(conteudo: Buffer | string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

function decodificarXml(valor: string): string {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo: string) => String.fromCodePoint(Number.parseInt(codigo, 16)));
}

function atributosXml(texto: string): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const correspondencia of texto.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    atributos[correspondencia[1]] = decodificarXml(correspondencia[2]);
  }
  return atributos;
}

function localizarFimDiretorioCentral(buffer: Buffer): number {
  const assinatura = 0x06054b50;
  const inicio = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= inicio; offset -= 1) {
    if (buffer.readUInt32LE(offset) === assinatura) return offset;
  }
  throw new Error('Arquivo XLSX invalido: diretorio ZIP nao encontrado.');
}

function extrairZip(buffer: Buffer): Map<string, Buffer> {
  const fim = localizarFimDiretorioCentral(buffer);
  const totalEntradas = buffer.readUInt16LE(fim + 10);
  let offset = buffer.readUInt32LE(fim + 16);
  const entradas = new Map<string, EntradaZip>();

  for (let indice = 0; indice < totalEntradas; indice += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Arquivo XLSX invalido: entrada do diretorio ZIP corrompida.');
    }
    const tamanhoNome = buffer.readUInt16LE(offset + 28);
    const tamanhoExtra = buffer.readUInt16LE(offset + 30);
    const tamanhoComentario = buffer.readUInt16LE(offset + 32);
    const nome = buffer.subarray(offset + 46, offset + 46 + tamanhoNome).toString('utf8').replace(/\\/g, '/');
    entradas.set(nome, {
      metodo: buffer.readUInt16LE(offset + 10),
      tamanhoComprimido: buffer.readUInt32LE(offset + 20),
      offsetCabecalhoLocal: buffer.readUInt32LE(offset + 42)
    });
    offset += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  const arquivos = new Map<string, Buffer>();
  for (const [nome, entrada] of entradas) {
    const local = entrada.offsetCabecalhoLocal;
    if (buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(`Arquivo XLSX invalido: cabecalho local ausente para ${nome}.`);
    }
    const tamanhoNome = buffer.readUInt16LE(local + 26);
    const tamanhoExtra = buffer.readUInt16LE(local + 28);
    const inicioDados = local + 30 + tamanhoNome + tamanhoExtra;
    const comprimido = buffer.subarray(inicioDados, inicioDados + entrada.tamanhoComprimido);
    if (entrada.metodo === 0) arquivos.set(nome, Buffer.from(comprimido));
    else if (entrada.metodo === 8) arquivos.set(nome, inflateRawSync(comprimido));
    else throw new Error(`Metodo de compressao ZIP nao suportado (${entrada.metodo}) em ${nome}.`);
  }
  return arquivos;
}

function arquivoObrigatorio(arquivos: Map<string, Buffer>, caminho: string): string {
  const arquivo = arquivos.get(caminho);
  if (!arquivo) throw new Error(`Arquivo obrigatorio ausente no XLSX: ${caminho}.`);
  return arquivo.toString('utf8');
}

function lerStringsCompartilhadas(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((item) =>
    [...item[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((texto) => decodificarXml(texto[1]))
      .join('')
  );
}

function localizarXmlDaAba(arquivos: Map<string, Buffer>, nomeAba: string): string {
  const workbook = arquivoObrigatorio(arquivos, 'xl/workbook.xml');
  const relacionamentos = arquivoObrigatorio(arquivos, 'xl/_rels/workbook.xml.rels');
  const folha = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)]
    .map((item) => atributosXml(item[1]))
    .find((item) => item.name === nomeAba);
  if (!folha?.['r:id']) throw new Error(`Aba nao encontrada no XLSX: ${nomeAba}.`);

  const relacao = [...relacionamentos.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)]
    .map((item) => atributosXml(item[1]))
    .find((item) => item.Id === folha['r:id']);
  if (!relacao?.Target) throw new Error(`Relacionamento da aba ${nomeAba} nao encontrado.`);

  const alvo = relacao.Target.replace(/^\//, '').replace(/\\/g, '/');
  const caminho = alvo.startsWith('xl/') ? alvo : `xl/${alvo}`;
  return arquivoObrigatorio(arquivos, caminho);
}

function lerLinhas(xml: string, compartilhadas: string[]): LinhaPlanilha[] {
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((item) => {
    const atributosLinha = atributosXml(item[1]);
    const celulas = new Map<string, CelulaPlanilha>();
    for (const celula of item[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = atributosXml(celula[1]);
      const coluna = atributos.r?.match(/^[A-Z]+/)?.[0];
      if (!coluna) continue;
      const corpo = celula[2] ?? '';
      const valorBruto = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const textoInline = [...corpo.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((texto) => decodificarXml(texto[1]))
        .join('');
      const valor =
        atributos.t === 's' && valorBruto !== undefined
          ? compartilhadas[Number(valorBruto)] ?? ''
          : atributos.t === 'inlineStr'
            ? textoInline
            : decodificarXml(valorBruto ?? '');
      celulas.set(coluna, { tipo: atributos.t ?? '', valor: valor.trim() });
    }
    return { numero: Number(atributosLinha.r), celulas };
  });
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  const resultado = Math.round((valor + Number.EPSILON) * fator) / fator;
  return Object.is(resultado, -0) ? 0 : resultado;
}

export function normalizarNutriente(valor: string, casas: number): number | null | 'invalido' {
  const normalizado = valor.trim();
  if (!normalizado || normalizado === 'NA') return null;
  if (normalizado === 'Tr') return 0;
  if (normalizado === '*') return 'invalido';
  const numero = Number(normalizado.replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return 'invalido';
  return arredondar(numero, casas);
}

export function calcularSha256Alimentos(alimentos: AlimentoTaco[]): string {
  return sha256(JSON.stringify(alimentos));
}

export function validarIdentidadeCatalogoTaco(catalogo: CatalogoTaco): {
  versaoArtefato: string;
  sha256Alimentos: string;
} {
  const versaoArtefato = catalogo.metadados.versaoArtefato.trim();
  if (!versaoArtefato) throw new Error('Catalogo TACO sem versao de artefato.');
  const sha256Alimentos = calcularSha256Alimentos(catalogo.alimentos);
  if (sha256Alimentos !== catalogo.metadados.sha256Alimentos) {
    throw new Error('Catalogo TACO recusado: hash dos alimentos normalizados nao confere.');
  }
  return { versaoArtefato, sha256Alimentos };
}

export function montarCatalogoTaco(buffer: Buffer, urlArquivo = TACO_URL_ORIGEM): CatalogoTaco {
  const arquivos = extrairZip(buffer);
  const compartilhadas = lerStringsCompartilhadas(arquivos.get('xl/sharedStrings.xml')?.toString('utf8'));
  const linhas = lerLinhas(localizarXmlDaAba(arquivos, TACO_ABA_ORIGEM), compartilhadas);
  const alimentos: AlimentoTaco[] = [];
  const exclusoesPorMotivo: Record<string, number> = {};
  const exclusoes: CatalogoTaco['metadados']['exclusoes'] = [];
  const codigos = new Set<number>();
  let categoria = '';
  let candidatos = 0;

  for (const linha of linhas) {
    const valorA = linha.celulas.get('A')?.valor ?? '';
    const descricao = linha.celulas.get('B')?.valor ?? '';
    const codigo = /^\d+$/.test(valorA) ? Number(valorA) : undefined;

    if (codigo === undefined) {
      if (
        valorA &&
        !descricao &&
        linha.numero > 3 &&
        !['Alimento', 'Numero do', 'Número do', 'Legenda', '*', '†', '††', '†††', '††††'].includes(valorA)
      ) {
        categoria = valorA;
      }
      continue;
    }

    candidatos += 1;
    let motivo: string | undefined;
    if (!descricao) motivo = 'descricao_ausente';
    else if (!categoria) motivo = 'categoria_ausente';
    else if (codigos.has(codigo)) motivo = 'codigo_duplicado';

    const nutrientes: Partial<Record<(typeof CAMPOS_NUTRICIONAIS)[number][1], number | null>> = {};
    for (const [coluna, campo, casas] of CAMPOS_NUTRICIONAIS) {
      const valor = normalizarNutriente(linha.celulas.get(coluna)?.valor ?? '', casas);
      if (valor === 'invalido') motivo ??= 'valor_nutricional_em_reavaliacao_ou_invalido';
      else nutrientes[campo] = valor;
    }

    if (motivo) {
      exclusoesPorMotivo[motivo] = (exclusoesPorMotivo[motivo] ?? 0) + 1;
      exclusoes.push({ codigo, descricao, motivo });
      continue;
    }

    codigos.add(codigo);
    alimentos.push({
      codigo,
      descricao,
      categoria,
      energiaKcal: nutrientes.energiaKcal ?? null,
      proteinaG: nutrientes.proteinaG ?? null,
      lipideosG: nutrientes.lipideosG ?? null,
      carboidratoG: nutrientes.carboidratoG ?? null,
      fibraG: nutrientes.fibraG ?? null,
      sodioMg: nutrientes.sodioMg ?? null
    });
  }

  alimentos.sort((a, b) => a.codigo - b.codigo);
  const excluidos = Object.values(exclusoesPorMotivo).reduce((total, atual) => total + atual, 0);
  return {
    metadados: {
      versaoArtefato: 'taco-4a-cmvcol-taco3-v1',
      fonte: {
        nome: 'Tabela Brasileira de Composicao de Alimentos - TACO',
        instituicao: 'NEPA/UNICAMP',
        edicao: '4a edicao revisada e ampliada',
        ano: 2011,
        aba: TACO_ABA_ORIGEM,
        unidadeBase: 'por 100 g de parte comestivel',
        urlArquivo,
        urlPublicacao: 'https://nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/',
        licenca: {
          tipo: 'reproducao-permitida-com-atribuicao',
          texto: 'E permitida a reproducao total ou parcial do material, desde que seja citada a fonte.',
          atribuicaoObrigatoria: 'NEPA/UNICAMP. Tabela Brasileira de Composicao de Alimentos - TACO. 4a ed. rev. e ampl. Campinas, 2011.'
        }
      },
      arquivoOrigem: {
        sha256: sha256(buffer),
        tamanhoBytes: buffer.length
      },
      transformacao: {
        traco: 'Tr e convertido para 0. A TACO usa Tr para valor abaixo do criterio de arredondamento ou do limite de quantificacao.',
        naoAplicavel: 'NA e preservado como null.',
        ausente: 'Celula vazia e preservada como null.',
        arredondamento: {
          energiaKcal: 'inteiro, conforme formato da planilha',
          proteinaG: 'uma casa decimal, conforme formato da planilha',
          lipideosG: 'uma casa decimal, conforme formato da planilha',
          carboidratoG: 'uma casa decimal, conforme formato da planilha',
          fibraG: 'uma casa decimal, conforme formato da planilha',
          sodioMg: 'inteiro, conforme formato da planilha'
        }
      },
      contagem: {
        linhasPlanilha: linhas.length,
        linhasNaoAlimento: linhas.length - candidatos,
        alimentosCandidatos: candidatos,
        alimentosValidos: alimentos.length,
        alimentosExcluidos: excluidos,
        exclusoesPorMotivo
      },
      exclusoes,
      sha256Alimentos: calcularSha256Alimentos(alimentos)
    },
    alimentos
  };
}

export function serializarCatalogoTaco(catalogo: CatalogoTaco): string {
  return `${JSON.stringify(catalogo, null, 2)}\n`;
}
