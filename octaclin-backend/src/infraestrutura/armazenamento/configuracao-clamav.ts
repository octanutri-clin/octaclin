/**
 * Configuracao do ClamAV real (Fase 261). Mesmo padrao de
 * `configuracao-redis.ts`: funcoes puras sobre `process.env`, sem estado, sem
 * Nest. `CLAMAV_HOST` e a chave que decide o mecanismo: presente, usa o
 * scanner real; ausente, `ServicoAntimalware` continua com a referencia EICAR
 * (dev local, CI, qualquer ambiente sem o daemon provisionado).
 */
function valorAmbienteDefinido(nome: string): boolean {
  return Boolean(process.env[nome]?.trim());
}

export function clamavConfigurado(): boolean {
  return valorAmbienteDefinido('CLAMAV_HOST');
}

export interface ConfiguracaoClamav {
  host: string;
  porta: number;
  timeoutMs: number;
}

const PORTA_PADRAO_CLAMD = 3310;
const TIMEOUT_PADRAO_MS = 5000;

export function obterConfiguracaoClamav(): ConfiguracaoClamav {
  const porta = Number(process.env.CLAMAV_PORTA?.trim());
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS?.trim());

  return {
    host: process.env.CLAMAV_HOST?.trim() || 'localhost',
    porta: Number.isInteger(porta) && porta > 0 ? porta : PORTA_PADRAO_CLAMD,
    timeoutMs: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : TIMEOUT_PADRAO_MS
  };
}
