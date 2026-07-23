import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

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

@Injectable()
export class ServicoProtecaoAbuso {
  private readonly registros = new Map<string, RegistroProtecaoAbuso>();

  verificarDisponibilidade(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): void {
    const registro = this.registros.get(chave);
    if (!registro) return;

    if (registro.bloqueadoAte && registro.bloqueadoAte > agora) {
      throw new HttpException(politica.mensagemBloqueio, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (registro.expiraEm <= agora || (registro.bloqueadoAte && registro.bloqueadoAte <= agora)) {
      this.registros.delete(chave);
    }
  }

  registrarFalha(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): void {
    this.verificarDisponibilidade(chave, politica, agora);

    const registro = this.registros.get(chave);
    if (!registro || registro.expiraEm <= agora) {
      this.registros.set(chave, {
        quantidade: 1,
        expiraEm: agora + politica.janelaMs
      });
      return;
    }

    registro.quantidade += 1;
    if (registro.quantidade >= politica.maxTentativas) {
      registro.bloqueadoAte = agora + politica.bloqueioMs;
    }
  }

  consumirTentativa(chave: string, politica: PoliticaProtecaoAbuso, agora = Date.now()): void {
    this.registrarFalha(chave, politica, agora);
  }

  registrarSucesso(chave: string): void {
    this.registros.delete(chave);
  }
}
