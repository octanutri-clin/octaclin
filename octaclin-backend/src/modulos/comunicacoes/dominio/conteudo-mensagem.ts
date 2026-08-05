/**
 * Separa o payload de notificacao em duas metades: o que a infra precisa ler em
 * claro e o conteudo, que vai criptografado.
 *
 * `mensagens_notificacao.payload` nasceu como telemetria de entrega e virou
 * deposito de texto: mensagem de agenda com nome do paciente, mensagem recebida
 * do proprio paciente, corpo de documento clinico. Tudo em `jsonb` legivel por
 * quem alcancar o banco ou um backup.
 *
 * ## Por que allowlist do que fica em claro, e nao denylist do que criptografa
 *
 * Campo novo entra no payload a todo momento. Com denylist, um campo de conteudo
 * novo vaza calado ate alguem notar. Com allowlist, ele e criptografado por
 * padrao e, se por acaso a infra precisava dele em claro, **quebra na hora e em
 * teste** — que e a direcao segura de errar.
 */

/**
 * Campos que a infraestrutura le, casa ou consulta.
 *
 * Nao entram aqui por serem inofensivos — `destino` e `remetente` sao contato do
 * paciente. Entram porque o produto ja depende deles em claro:
 * `mensagemPertenceAoContatoWhatsapp` casa mensagem por contato e o webhook
 * consulta `payload #>> '{idExterno}'` e `#>> '{resultadoEnvio,idExterno}'` em
 * SQL. Criptografar isto exige indice por hash deterministico e e outra fase.
 */
const CAMPOS_EM_CLARO = new Set([
  // roteamento e entrega
  'destino',
  'remetente',
  'contato',
  'phoneNumberId',
  'idioma',
  // classificacao
  'origem',
  'direcao',
  'tipo',
  'evento',
  'statusAtendimento',
  // rastreio de entrega (consultado em SQL)
  'idExterno',
  'resultadoEnvio',
  'ultimoStatusMeta',
  'timestamp',
  'registradoEm',
  // vinculos
  'consultaId',
  'documentoId',
  'consultaInicioEm',
  'consultaFimEm',
  'modalidade',
  'contatoAssociadoManualmente',
  'contatoAssociadoEm'
]);

export type PayloadMensagem = Record<string, unknown>;

export interface MensagemSeparada {
  /** Vai para a coluna `payload`, em claro. */
  metadados: PayloadMensagem;
  /** Vai criptografado. `undefined` quando nao ha conteudo algum. */
  conteudo?: PayloadMensagem;
}

export function separarConteudoMensagem(payload: PayloadMensagem = {}): MensagemSeparada {
  const metadados: PayloadMensagem = {};
  const conteudo: PayloadMensagem = {};

  for (const [chave, valor] of Object.entries(payload)) {
    if (CAMPOS_EM_CLARO.has(chave)) metadados[chave] = valor;
    else conteudo[chave] = valor;
  }

  return {
    metadados,
    ...(Object.keys(conteudo).length ? { conteudo } : {})
  };
}

/**
 * Remonta o payload como quem escreveu entregou. O conteudo tem precedencia:
 * se um campo existir dos dois lados, vale o que veio criptografado.
 */
export function juntarConteudoMensagem(
  metadados: PayloadMensagem = {},
  conteudo: PayloadMensagem = {}
): PayloadMensagem {
  return { ...metadados, ...conteudo };
}

export function campoFicaEmClaro(chave: string): boolean {
  return CAMPOS_EM_CLARO.has(chave);
}
