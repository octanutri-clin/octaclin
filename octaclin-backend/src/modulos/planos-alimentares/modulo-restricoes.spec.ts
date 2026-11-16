import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoConcessoesPermissao } from '../auth/aplicacao/servico-concessoes-permissao';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoConfirmacaoRestricao } from './aplicacao/servico-confirmacao-restricao';
import { ServicoLeituraRestricao } from './aplicacao/servico-leitura-restricao';
import { ServicoReconfirmacaoRestricao } from './aplicacao/servico-reconfirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from './aplicacao/servico-registro-pendencia-restricao';
import { ModuloPlanosAlimentares } from './modulo-planos-alimentares';
import { ModuloRestricoes } from './modulo-restricoes';

const executor = { executar: jest.fn() };
const concessoes = { exigir: jest.fn() };
@Module({ providers: [{ provide: ExecutorTenant, useValue: executor }], exports: [ExecutorTenant] })
class TenancySintetico {}
@Module({ providers: [{ provide: ServicoConcessoesPermissao, useValue: concessoes }], exports: [ServicoConcessoesPermissao] })
class AuthSintetico {}

describe('módulo de restrições clínicas', () => {
  it('registra os serviços no módulo de planos sem publicar controladores ou exportá-los', async () => {
    const imports = Reflect.getMetadata('imports', ModuloPlanosAlimentares) as unknown[];
    expect(imports).toContain(ModuloRestricoes);
    const modulo = await Test.createTestingModule({ imports: [ModuloRestricoes] })
      .overrideModule(ModuloTenancy).useModule(TenancySintetico)
      .overrideModule(ModuloAuth).useModule(AuthSintetico).compile();
    try {
      const escopo = modulo.select(ModuloRestricoes);
      for (const tipo of [ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao, ServicoReconfirmacaoRestricao, ServicoLeituraRestricao]) {
        const servico = escopo.get(tipo, { strict: true }) as unknown as { executor: unknown; cripto: unknown; concessoes?: unknown };
        expect(servico.executor).toBe(executor);
        expect(servico.cripto).toBeInstanceOf(CriptografiaDadosSensiveis);
        if (tipo !== ServicoRegistroPendenciaRestricao) expect(servico.concessoes).toBe(concessoes);
      }
      expect(Reflect.getMetadata('controllers', ModuloRestricoes) ?? []).toEqual([]);
      expect(Reflect.getMetadata('exports', ModuloRestricoes) ?? []).toEqual([]);
    } finally { await modulo.close(); }
  });
});
