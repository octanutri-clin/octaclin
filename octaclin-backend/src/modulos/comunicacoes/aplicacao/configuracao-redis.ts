function valorAmbienteDefinido(nome: string): boolean {
  return Boolean(process.env[nome]?.trim());
}

function valorOuIndefinido(valor?: string): string | undefined {
  const valorNormalizado = valor?.trim();
  return valorNormalizado && valorNormalizado.length > 0 ? valorNormalizado : undefined;
}

export function redisConfigurado(): boolean {
  return ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORTA'].some(valorAmbienteDefinido);
}

export function criarConexaoRedis() {
  if (process.env.REDIS_URL?.trim()) {
    const url = new URL(process.env.REDIS_URL);
    const porta = Number(url.port || 6379);

    return {
      host: url.hostname,
      port: porta,
      username: valorOuIndefinido(decodeURIComponent(url.username)),
      password: valorOuIndefinido(decodeURIComponent(url.password)),
      tls: url.protocol === 'rediss:' || process.env.REDIS_TLS === 'true' ? {} : undefined
    };
  }

  return {
    host: process.env.REDIS_HOST?.trim() || 'localhost',
    port: Number(process.env.REDIS_PORTA?.trim() || 6379),
    username: valorOuIndefinido(process.env.REDIS_USUARIO),
    password: valorOuIndefinido(process.env.REDIS_SENHA),
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  };
}
