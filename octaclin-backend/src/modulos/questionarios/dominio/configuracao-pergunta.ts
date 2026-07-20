import { BadRequestException } from '@nestjs/common';
import { TipoPergunta } from './tipos-pergunta';

type Configuracao = Record<string, unknown>;

function numero(valor: unknown, padrao: number): number {
  const normalizado = Number(valor);
  return Number.isFinite(normalizado) ? normalizado : padrao;
}

function texto(valor: unknown, padrao = ''): string {
  return typeof valor === 'string' ? valor : padrao;
}

function booleano(valor: unknown, padrao = false): boolean {
  return typeof valor === 'boolean' ? valor : padrao;
}

function listaTexto(valor: unknown, padrao: string[]): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : padrao;
}

function validarFaixa(minimo: number, maximo: number, contexto: string) {
  if (minimo >= maximo) {
    throw new BadRequestException(`${contexto}: minimo deve ser menor que maximo.`);
  }
}

function configuracaoComum(configuracao: Configuracao): Configuracao {
  const secao = texto(configuracao.secao).trim();
  return secao ? { secao } : {};
}

export function normalizarConfiguracaoPergunta(tipo: TipoPergunta, configuracao: Configuracao = {}): Configuracao {
  if (tipo === 'likert') {
    const escalaMin = numero(configuracao.escalaMin, 1);
    const escalaMax = numero(configuracao.escalaMax, 5);
    validarFaixa(escalaMin, escalaMax, 'Likert');
    return {
      ...configuracaoComum(configuracao),
      escalaMin,
      escalaMax,
      rotuloMin: texto(configuracao.rotuloMin, 'Discordo totalmente'),
      rotuloMax: texto(configuracao.rotuloMax, 'Concordo totalmente')
    };
  }

  if (tipo === 'multipla_escolha') {
    return { ...configuracaoComum(configuracao), multipla: booleano(configuracao.multipla, false) };
  }

  if (tipo === 'linear') {
    const minimo = numero(configuracao.minimo, 0);
    const maximo = numero(configuracao.maximo, 10);
    validarFaixa(minimo, maximo, 'Slider linear');
    return {
      ...configuracaoComum(configuracao),
      minimo,
      maximo,
      passo: Math.max(numero(configuracao.passo, 1), 0.01),
      rotuloMin: texto(configuracao.rotuloMin),
      rotuloMax: texto(configuracao.rotuloMax)
    };
  }

  if (tipo === 'metrica') {
    const minimo = numero(configuracao.minimo, 0);
    const maximo = numero(configuracao.maximo, 100);
    validarFaixa(minimo, maximo, 'Metrica');
    return {
      ...configuracaoComum(configuracao),
      unidade: texto(configuracao.unidade),
      minimo,
      maximo,
      passo: Math.max(numero(configuracao.passo, 1), 0.01)
    };
  }

  if (tipo === 'upload_midia') {
    return {
      ...configuracaoComum(configuracao),
      tiposAceitos: listaTexto(configuracao.tiposAceitos, ['image/*']),
      maxArquivos: Math.min(10, Math.max(1, Math.round(numero(configuracao.maxArquivos, 1))))
    };
  }

  if (tipo === 'texto_longo') {
    return {
      ...configuracaoComum(configuracao),
      limiteCaracteres: Math.min(5000, Math.max(1, Math.round(numero(configuracao.limiteCaracteres, 1000)))),
      placeholder: texto(configuracao.placeholder)
    };
  }

  if (tipo === 'sim_nao') {
    return {
      ...configuracaoComum(configuracao),
      rotuloSim: texto(configuracao.rotuloSim, 'Sim'),
      rotuloNao: texto(configuracao.rotuloNao, 'Nao')
    };
  }

  return {};
}
