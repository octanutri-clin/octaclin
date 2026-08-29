/**
 * Ambiente de execucao usado pelas decisoes de falha fechada.
 *
 * `NODE_ENV` sozinho nao distingue staging de local: o Render usa
 * `NODE_ENV=production` para os dois. `APP_AMBIENTE` existe para declarar o
 * ambiente real sem depender de heuristica; quando ausente, o fallback por
 * `NODE_ENV` mantem o comportamento anterior.
 */
export type AmbienteExecucao = 'local' | 'test' | 'staging' | 'producao';

const MAPA_APP_AMBIENTE: Record<string, AmbienteExecucao> = {
  local: 'local',
  development: 'local',
  desenvolvimento: 'local',
  dev: 'local',
  test: 'test',
  teste: 'test',
  staging: 'staging',
  homologacao: 'staging',
  hml: 'staging',
  production: 'producao',
  producao: 'producao',
  prod: 'producao'
};

export function obterAmbienteExecucao(): AmbienteExecucao {
  const declarado = process.env.APP_AMBIENTE?.trim().toLowerCase();

  if (declarado) {
    const ambiente = MAPA_APP_AMBIENTE[declarado];
    if (!ambiente) {
      throw new Error(
        `APP_AMBIENTE invalido. Use um de: ${[...new Set(Object.keys(MAPA_APP_AMBIENTE))].join(', ')}.`
      );
    }
    return ambiente;
  }

  if (process.env.NODE_ENV === 'production') return 'producao';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'local';
}

/**
 * Ambientes que carregam ou podem carregar dado real. Neles, configuracao
 * ausente ou invalida precisa derrubar o processo em vez de degradar para um
 * modo permissivo.
 */
export function ambienteExigeFalhaFechada(): boolean {
  const ambiente = obterAmbienteExecucao();
  return ambiente === 'staging' || ambiente === 'producao';
}
