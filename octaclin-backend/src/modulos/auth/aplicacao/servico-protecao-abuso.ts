import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

export interface PoliticaProtecaoAbuso {
  maxTentativas: number;
  janelaMs: number;
  bloqueioMs: number;
  mensagemBloqueio: string;
}

interface RegistroProtecaoAbuso {
  quantidade: number;
  expiraEm: number;
  bloqueadoAte?: number;
}

export const POLITICA_LOGIN: PoliticaProtecaoAbuso = {
  maxTentativas: 5,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 15 * 60 * 1000,
  mensagemBloqueio: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
};

export const POLITICA_RECUPERACAO_SENHA: PoliticaProtecaoAbuso = {
  maxTentativas: 3,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 30 * 60 * 1000,
  mensagemBloqueio: 'Muitas solicitacoes de recuperacao de senha. Tente novamente em alguns minutos.'
};

export const POLITICA_CONVITES_ADMIN: PoliticaProtecaoAbuso = {
  maxTentativas: 10,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 30 * 60 * 1000,
  mensagemBloqueio: 'Muitas acoes de convite. Tente novamente em alguns minutos.'
};

export function montarChaveProtecaoAbuso(escopo: string, tenantSlug?: string, email?: string) {
  return [
    escopo.trim().toLowerCase(),
    (tenantSlug ?? 'tenant-desconhecido').trim().toLowerCase(),
    (email ?? 'email-desconhecido').trim().toLowerCase()
  ].join(':');
}

export const REDIS_PROTECAO_ABUSO = 'REDIS_PROTECAO_ABUSO';

const SCRIPT_REGISTRAR_FALHA = `
local chave = KEYS[1]
local agora = tonumber(ARGV[1])
local janelaMs = tonumber(ARGV[2])
local maxTentativas = tonumber(ARGV[3])
local bloqueioMs = tonumber(ARGV[4])
local bruto = redis.call('GET', chave)
local registro = nil

if bruto then
  local ok, valor = pcall(cjson.decode, bruto)
  if ok then registro = valor end
end

if not registro or registro.expiraEm <= agora then
  registro = { quantidade = 0, expiraEm = agora + janelaMs }
end

registro.quantidade = registro.quantidade + 1
local ttlMs = registro.expiraEm - agora

if registro.quantidade >= maxTentativas then
  registro.bloqueadoAte = agora + bloqueioMs
  ttlMs = bloqueioMs
end

redis.call('SET', chave, cjson.encode(registro), 'PX', math.max(ttlMs, 1000))
return { registro.quantidade, registro.bloqueadoAte or 0 }
`;

export interface ClienteRedisProtecaoAbuso {
  get(chave: string): Promise<string | null>;
  set(chave: string, valor: string, modo: 'PX', duracaoMs: number): Promise<unknown>;
  del(chave: string): Promise<unknown>;
  eval(script: string, quantidadeChaves: number, ...argumentos: string[]): Promise<unknown>;
}

@Injectable()
export class ServicoProtecaoAbuso {
  constructor(@Inject(REDIS_PROTECAO_ABUSO) private readonly redis: ClienteRedisProtecaoAbuso) {}

  private async obterRegistro(chave: string): Promise<RegistroProtecaoAbuso | null> {
    const bruto = await this.redis.get(chave);
    if (!bruto) return null;

    try {
      return JSON.parse(bruto) as RegistroProtecaoAbuso;
    } catch {
      return null;
    }
  }

  async verificarDisponibilidade(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): Promise<void> {
    const registro = await this.obterRegistro(chave);
    if (!registro) return;

    if (registro.bloqueadoAte && registro.bloqueadoAte > agora) {
      throw new HttpException(politica.mensagemBloqueio, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (registro.expiraEm <= agora || (registro.bloqueadoAte && registro.bloqueadoAte <= agora)) {
      await this.redis.del(chave);
    }
  }

  async registrarFalha(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): Promise<void> {
    await this.verificarDisponibilidade(chave, politica, agora);
    await this.redis.eval(
      SCRIPT_REGISTRAR_FALHA,
      1,
      chave,
      String(agora),
      String(politica.janelaMs),
      String(politica.maxTentativas),
      String(politica.bloqueioMs)
    );
  }

  async consumirTentativa(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): Promise<void> {
    await this.registrarFalha(chave, politica, agora);
  }

  async registrarSucesso(chave: string): Promise<void> {
    await this.redis.del(chave);
  }
}
