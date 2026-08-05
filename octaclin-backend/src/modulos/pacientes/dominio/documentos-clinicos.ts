/**
 * Documentos clinicos gerados a partir de dados que ja existem no prontuario.
 *
 * Dois tipos nesta fase:
 * - `declaracao_comparecimento`: prova de presenca, sai de consulta concluida.
 * - `relatorio_alta`: fecha o ciclo de acompanhamento.
 *
 * **Atestado ficou de fora de proposito.** Atestado medico e ato privativo de
 * medico (CFM) e o produto atende tambem nutricionista, psicologo e educador
 * fisico. Gerar "atestado" para qualquer profissional cadastrado colocaria o
 * usuario a emitir documento que ele nao pode emitir. Declaracao de
 * comparecimento nao tem essa restricao: atesta presenca, nao condicao de saude.
 */

export type TipoDocumentoClinico = 'declaracao_comparecimento' | 'relatorio_alta';

export const TIPOS_DOCUMENTO_CLINICO: readonly TipoDocumentoClinico[] = [
  'declaracao_comparecimento',
  'relatorio_alta'
];

export interface ModeloDocumento {
  titulo: string;
  corpo: string;
}

export const TAMANHO_MAXIMO_TITULO = 180;
export const TAMANHO_MAXIMO_CORPO = 8000;

/** Variaveis que todo documento resolve, independente do tipo. */
const VARIAVEIS_COMUNS = [
  'clinicaNome',
  'clinicaDocumento',
  'clinicaEndereco',
  'pacienteNome',
  'profissionalNome',
  'profissionalRegistro',
  'profissionalEspecialidade',
  'dataEmissao',
  'cidadeEmissao'
] as const;

const VARIAVEIS_ESPECIFICAS: Record<TipoDocumentoClinico, readonly string[]> = {
  declaracao_comparecimento: ['dataConsulta', 'horaInicio', 'horaFim', 'duracaoMinutos', 'modalidade'],
  relatorio_alta: [
    'periodoInicio',
    'periodoFim',
    'totalConsultas',
    'metasConcluidas',
    'metasTotais',
    'conteudo'
  ]
};

export function variaveisDoTipo(tipo: TipoDocumentoClinico): string[] {
  return [...VARIAVEIS_COMUNS, ...VARIAVEIS_ESPECIFICAS[tipo]];
}

/**
 * Modelo padrao de cada tipo. Fica em codigo, nao em seed: clinica nova emite
 * documento no primeiro dia sem configurar nada, e o modelo do tenant e um
 * override por cima disto (ver `resolverModelo`).
 */
export const MODELOS_PADRAO: Record<TipoDocumentoClinico, ModeloDocumento> = {
  declaracao_comparecimento: {
    titulo: 'Declaracao de comparecimento',
    corpo: [
      'Declaro para os devidos fins que {{pacienteNome}} compareceu a atendimento nesta',
      'clinica no dia {{dataConsulta}}, no periodo das {{horaInicio}} as {{horaFim}}',
      '({{duracaoMinutos}} minutos), na modalidade {{modalidade}}.',
      '',
      '{{cidadeEmissao}}, {{dataEmissao}}.',
      '',
      '{{profissionalNome}}',
      '{{profissionalEspecialidade}} - {{profissionalRegistro}}'
    ].join('\n')
  },
  relatorio_alta: {
    titulo: 'Relatorio de alta',
    corpo: [
      'Paciente: {{pacienteNome}}',
      'Periodo de acompanhamento: {{periodoInicio}} a {{periodoFim}}',
      'Consultas realizadas: {{totalConsultas}}',
      'Metas do plano concluidas: {{metasConcluidas}} de {{metasTotais}}',
      '',
      '{{conteudo}}',
      '',
      '{{cidadeEmissao}}, {{dataEmissao}}.',
      '',
      '{{profissionalNome}}',
      '{{profissionalEspecialidade}} - {{profissionalRegistro}}'
    ].join('\n')
  }
};

const PADRAO_VARIAVEL = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function resolverModelo(tipo: TipoDocumentoClinico, override?: Partial<ModeloDocumento>): ModeloDocumento {
  const padrao = MODELOS_PADRAO[tipo];
  const titulo = override?.titulo?.trim();
  const corpo = override?.corpo?.trim();
  return {
    titulo: titulo || padrao.titulo,
    corpo: corpo || padrao.corpo
  };
}

/**
 * Valida o modelo que o tenant salvou. Variavel desconhecida e **erro**, nao
 * aviso: se passasse, a declaracao sairia com um buraco no lugar do nome e
 * ninguem descobriria ate o paciente entregar o papel no trabalho dele.
 */
export function validarModelo(tipo: TipoDocumentoClinico, modelo: Partial<ModeloDocumento>): string[] {
  const erros: string[] = [];
  const titulo = modelo.titulo?.trim() ?? '';
  const corpo = modelo.corpo?.trim() ?? '';

  if (titulo.length > TAMANHO_MAXIMO_TITULO) erros.push('titulo_muito_longo');
  if (corpo.length > TAMANHO_MAXIMO_CORPO) erros.push('corpo_muito_longo');

  const conhecidas = new Set(variaveisDoTipo(tipo));
  for (const usada of extrairVariaveis(corpo)) {
    if (!conhecidas.has(usada)) erros.push(`variavel_desconhecida:${usada}`);
  }
  for (const usada of extrairVariaveis(titulo)) {
    if (!conhecidas.has(usada)) erros.push(`variavel_desconhecida:${usada}`);
  }

  return erros;
}

export function extrairVariaveis(texto: string): string[] {
  return [...new Set([...texto.matchAll(PADRAO_VARIAVEL)].map((ocorrencia) => ocorrencia[1]))];
}

export interface DocumentoRenderizado {
  titulo: string;
  corpo: string;
  variaveisVazias: string[];
}

/**
 * Substituicao em passada unica: valor que por acaso contenha `{{algo}}` entra
 * como texto literal e nao e reexpandido. E o que impede um nome de paciente de
 * virar superficie de injecao de variavel.
 *
 * O resultado e **texto puro**. Nada aqui produz HTML; quem exibe escapa.
 */
export function renderizarDocumento(
  modelo: ModeloDocumento,
  variaveis: Record<string, string | undefined>
): DocumentoRenderizado {
  const vazias = new Set<string>();
  const aplicar = (texto: string) =>
    texto.replace(PADRAO_VARIAVEL, (_correspondencia, chave: string) => {
      const valor = variaveis[chave];
      if (valor === undefined || valor === null || String(valor).trim() === '') {
        vazias.add(chave);
        return '';
      }
      return String(valor);
    });

  return {
    titulo: aplicar(modelo.titulo).trim(),
    corpo: aplicar(modelo.corpo).trimEnd(),
    variaveisVazias: [...vazias]
  };
}

/** Quebra o corpo em paragrafos para a folha impressa. Linha vazia separa. */
export function paragrafosDocumento(corpo: string): string[] {
  return corpo
    .split(/\n{2,}/)
    .map((paragrafo) => paragrafo.trim())
    .filter((paragrafo) => paragrafo.length > 0);
}

/** Endereco da clinica em uma linha, pulando o que nao foi preenchido. */
export function enderecoEmLinha(endereco: {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}): string {
  const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
  const municipio = [endereco.cidade, endereco.uf].filter(Boolean).join('/');
  return [rua, endereco.bairro, municipio, endereco.cep].filter(Boolean).join(' - ');
}
