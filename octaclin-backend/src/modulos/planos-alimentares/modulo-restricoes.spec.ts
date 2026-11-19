import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoConcessoesPermissao } from '../auth/aplicacao/servico-concessoes-permissao';
import { ServicoProtecaoAbuso } from '../auth/aplicacao/servico-protecao-abuso';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoConfirmacaoRestricao } from './aplicacao/servico-confirmacao-restricao';
import { ServicoLeituraRestricao } from './aplicacao/servico-leitura-restricao';
import { ServicoReconfirmacaoRestricao } from './aplicacao/servico-reconfirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from './aplicacao/servico-registro-pendencia-restricao';
import { ModuloPlanosAlimentares } from './modulo-planos-alimentares';
import { ModuloRestricoes } from './modulo-restricoes';
import { ControladorRestricoesClinicas } from './apresentacao/controlador-restricoes-clinicas';
import { ControladorRestricoesColaborador } from './apresentacao/controlador-restricoes-colaborador';
import { ControladorDelegacoesCarteira } from '../profissionais/apresentacao/controlador-delegacoes-carteira';
import { ServicoDelegacoesCarteira } from '../profissionais/aplicacao/servico-delegacoes-carteira';
import { ControladorRepresentantesPaciente } from '../pacientes/apresentacao/controlador-representantes-paciente';
import { ControladorPortalRestricoes } from './apresentacao/controlador-portal-restricoes';
import { ControladorPortalRestricoesPaciente } from './apresentacao/controlador-portal-restricoes-paciente';
import { ControladorDisponibilidadeRestricoes } from './apresentacao/controlador-disponibilidade-restricoes';
import { ServicoFeatureFlags } from '../../infraestrutura/feature-flags/servico-feature-flags';
import { ServicoVinculosRepresentacao } from '../pacientes/aplicacao/servico-vinculos-representacao';
import { ServicoPortalRestricoes } from './aplicacao/servico-portal-restricoes';
import { CHAVE_FEATURE_FLAG, GuardaFeatureFlag } from '../../infraestrutura/feature-flags/guarda-feature-flag';
import { GuardaJwt } from '../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../auth/apresentacao/guarda-permissoes';

const executor = { executar: jest.fn() };
const concessoes = { exigir: jest.fn() };
@Module({ providers: [{ provide: ExecutorTenant, useValue: executor }], exports: [ExecutorTenant] })
class TenancySintetico {}
// P3-0b: a busca de representante consome a cota de `ServicoProtecaoAbuso`, exportado pelo ModuloAuth real.
const protecao = { consumirTentativa: jest.fn() };
@Module({ providers: [{ provide: ServicoConcessoesPermissao, useValue: concessoes }, { provide: ServicoProtecaoAbuso, useValue: protecao }],
  exports: [ServicoConcessoesPermissao, ServicoProtecaoAbuso] })
class AuthSintetico {}
@Global()
@Module({ providers: [{ provide: ServicoFeatureFlags, useValue: { habilitada: async () => false } }], exports: [ServicoFeatureFlags] })
class FlagsSintetico {}

describe('módulo de restrições clínicas', () => {
  it('publica só os controladores clínico, do colaborador e da delegação, todos atrás da flag restricoes.clinicas depois da guarda JWT (P2b/P2d-2)', () => {
    const controladores = [ControladorRestricoesClinicas, ControladorRestricoesColaborador, ControladorDelegacoesCarteira,
      ControladorRepresentantesPaciente, ControladorPortalRestricoes, ControladorPortalRestricoesPaciente];
    expect(Reflect.getMetadata('controllers', ModuloRestricoes)).toEqual([...controladores, ControladorDisponibilidadeRestricoes]);
    // Exceção nominal (P3-0a): a disponibilidade responde se a flag está ligada, então não pode ficar atrás dela. Só JWT e papel;
    // depende apenas do serviço de flags (sem leitura clínica).
    expect(Reflect.getMetadata(CHAVE_FEATURE_FLAG, ControladorDisponibilidadeRestricoes)).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', ControladorDisponibilidadeRestricoes)).toEqual([GuardaJwt, GuardaPapeis]);
    expect(Reflect.getMetadata('design:paramtypes', ControladorDisponibilidadeRestricoes)).toEqual([ServicoFeatureFlags]);
    for (const c of controladores) {
      expect(Reflect.getMetadata(CHAVE_FEATURE_FLAG, c)).toBe('restricoes.clinicas');
      const guardas = Reflect.getMetadata('__guards__', c) as unknown[];
      expect(guardas).toEqual([GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag]);
    }
    expect(Reflect.getMetadata('exports', ModuloRestricoes) ?? []).toEqual([]);
  });
  it('registra os serviços no módulo de planos sem exportá-los', async () => {
    const imports = Reflect.getMetadata('imports', ModuloPlanosAlimentares) as unknown[];
    expect(imports).toContain(ModuloRestricoes);
    const modulo = await Test.createTestingModule({ imports: [ModuloRestricoes, FlagsSintetico] })
      .overrideModule(ModuloTenancy).useModule(TenancySintetico)
      .overrideModule(ModuloAuth).useModule(AuthSintetico)
      .overrideGuard(GuardaJwt).useValue({ canActivate: () => false })
      .overrideGuard(GuardaPapeis).useValue({ canActivate: () => false })
      .overrideGuard(GuardaPermissoes).useValue({ canActivate: () => false })
      .overrideGuard(GuardaFeatureFlag).useValue({ canActivate: () => false }).compile();
    try {
      const escopo = modulo.select(ModuloRestricoes);
      for (const tipo of [ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao, ServicoReconfirmacaoRestricao, ServicoLeituraRestricao]) {
        const servico = escopo.get(tipo, { strict: true }) as unknown as { executor: unknown; cripto: unknown; concessoes?: unknown };
        expect(servico.executor).toBe(executor);
        expect(servico.cripto).toBeInstanceOf(CriptografiaDadosSensiveis);
        if (tipo !== ServicoRegistroPendenciaRestricao) expect(servico.concessoes).toBe(concessoes);
      }
      for (const tipo of [ServicoDelegacoesCarteira, ServicoVinculosRepresentacao, ServicoPortalRestricoes]) {
        expect((escopo.get(tipo, { strict: true }) as unknown as { executor: unknown }).executor).toBe(executor);
      }
      expect(Reflect.getMetadata('exports', ModuloRestricoes) ?? []).toEqual([]);
    } finally { await modulo.close(); }
  });
});
