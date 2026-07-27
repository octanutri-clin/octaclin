import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
import { ControladorQuestionarios } from './controlador-questionarios';

describe('ControladorQuestionarios', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['questionarios.gerenciar']
  };

  const envioRevisado = {
    id: 'envio-1',
    tenantId: 'tenant-1',
    questionarioId: 'questionario-1',
    pacienteId: 'paciente-1',
    status: 'respondido' as const,
    revisadoEm: new Date('2026-07-27T15:00:00.000Z'),
    revisadoPorUsuarioId: 'usuario-1',
    tokenFormulario: 'tenant-1.envio-1.assinatura',
    linkFormulario: 'https://app.octaclin.test/formularios/tenant-1.envio-1.assinatura'
  };

  function criarCenario(origemForjada = 'dashboard_clinico') {
    const marcarEnvioComoRevisado = jest.fn().mockResolvedValue(envioRevisado);
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorQuestionarios(
      { marcarEnvioComoRevisado } as unknown as ServicoQuestionarios,
      { registrar } as unknown as ServicoAuditoria
    );
    const requisicao = {
      header: jest.fn((nome: string) => (nome === 'x-octaclin-origem' ? origemForjada : undefined)),
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1'
    } as unknown as Request;

    return { controlador, marcarEnvioComoRevisado, registrar, requisicao };
  }

  it('ignora origem externa forjada e audita a origem segura do backend', async () => {
    const { controlador, registrar, requisicao } = criarCenario('origem_forjada');

    await controlador.revisarEnvio(usuario, requisicao, 'envio-1');

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'questionarios.envio.revisar',
        metadados: {
          origem: 'questionarios',
          revisadoEm: envioRevisado.revisadoEm
        }
      })
    );
    expect(requisicao.header).not.toHaveBeenCalledWith('x-octaclin-origem');
  });

  it('retorna apenas os campos clinicos minimos da revisao', async () => {
    const { controlador, requisicao } = criarCenario();

    const resposta = await controlador.revisarEnvio(usuario, requisicao, 'envio-1');

    expect(resposta).toEqual({
      id: 'envio-1',
      status: 'respondido',
      revisadoEm: envioRevisado.revisadoEm,
      revisadoPorUsuarioId: 'usuario-1'
    });
    expect(resposta).not.toHaveProperty('tokenFormulario');
    expect(resposta).not.toHaveProperty('linkFormulario');
    expect(resposta).not.toHaveProperty('tenantId');
    expect(resposta).not.toHaveProperty('pacienteId');
  });
});
