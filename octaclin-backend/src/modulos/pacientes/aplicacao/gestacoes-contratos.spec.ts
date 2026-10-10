import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { ControladorGestacoesPaciente } from '../apresentacao/controlador-gestacoes-paciente';
import { ControladorPortalGestacoes } from '../apresentacao/controlador-portal-gestacoes';
import { ContextoGestacionalDto, CriarGestacaoDto, PaginaGestacoesDto } from './dtos-gestacoes';
import { ServicoGestacoesPaciente, dataGestacionalValida } from './servico-gestacoes-paciente';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

describe('Contratos e autorizacao da Fase 313', () => {
  it('exige JWT/papel/permissao em todo metodo profissional e apenas Patient no portal', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA,ControladorGestacoesPaciente)).toEqual([GuardaJwt,GuardaPapeis,GuardaPermissoes]);
    expect(Reflect.getMetadata(GUARDS_METADATA,ControladorPortalGestacoes)).toEqual([GuardaJwt,GuardaPapeis]);
    expect(Reflect.getMetadata(CHAVE_PAPEIS,ControladorPortalGestacoes)).toEqual(['Patient']);
    for (const nome of ['listar','detalhe'] as const) expect(Reflect.getMetadata(CHAVE_PERMISSOES,ControladorGestacoesPaciente.prototype[nome])).toEqual(['pacientes.ler']);
    for (const nome of ['criar','referencia','encerrar','reabrir','compartilhar'] as const) expect(Reflect.getMetadata(CHAVE_PERMISSOES,ControladorGestacoesPaciente.prototype[nome])).toEqual(['pacientes.gerenciar']);
  });
  it.each(['Patient','Client','Professional'] as const)('nega permissao ausente antes de acessar o executor: %s', async papel => {
    const executar = jest.fn();
    const s = new ServicoGestacoesPaciente({ executar } as unknown as ExecutorTenant,{} as CriptografiaDadosSensiveis);
    const u: UsuarioAutenticado = { tenantId: 'tenant',usuarioId: 'usuario',papel,permissoes: [],emailHash: 'sintetico' };
    await expect(s.listar('tenant','paciente',u)).rejects.toThrow('Acesso nao autorizado');
    await expect(s.criar('tenant','paciente',u,{} as CriarGestacaoDto)).rejects.toThrow('Acesso nao autorizado');
    expect(executar).not.toHaveBeenCalled();
  });
  it('nega tenant diferente mesmo com permissao', async () => {
    const executar = jest.fn();
    const s = new ServicoGestacoesPaciente({ executar } as unknown as ExecutorTenant,{} as CriptografiaDadosSensiveis);
    const u: UsuarioAutenticado = { tenantId: 'tenant-a',usuarioId: 'usuario',papel: 'Professional',permissoes: ['pacientes.ler'],emailHash: 'sintetico' };
    await expect(s.listar('tenant-b','paciente',u)).rejects.toThrow('Acesso nao autorizado');
    expect(executar).not.toHaveBeenCalled();
  });
  it.each([{ semanas: 22.5 },{ dias: 7 },{ origemIdadeGestacional: 'estimada' },{ gestacaoId: 'outro-paciente' }])('rejeita contexto invalido: %j', async entrada => {
    expect(await validate(plainToInstance(ContextoGestacionalDto,entrada))).not.toHaveLength(0);
  });
  it('valida campos aninhados e limite do cursor sem aceitar peso habitual como estimativa', async () => {
    expect(await validate(plainToInstance(CriarGestacaoDto,{ confirmar: true,chaveCriacao: '31300000-0000-4000-8000-000000000001',referencia: { pesoKg: 501,origem: 'estimado' } }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(PaginaGestacoesDto,{ limite: '51' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(PaginaGestacoesDto,{ limite: '50' }))).toHaveLength(0);
  });
  it.each([['2026-02-29',false],['2024-02-29',true],['2026-04-31',false],['2026-10-10',true]])('confere data civil %s', (data,esperado) => {
    expect(dataGestacionalValida(data as string)).toBe(esperado);
  });
});
