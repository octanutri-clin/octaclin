import { Request } from 'express';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ControladorGamificacao } from './controlador-gamificacao';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-1',
  permissoes: ['gamificacao.gerenciar']
};

const requisicao = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'jest' }
} as Request;

function criarControlador() {
  const configuracao = {
    metasBadgesHabilitados: false,
    comunidadeHabilitada: false,
    rankingHabilitado: false
  };
  const servico = {
    obterConfiguracao: jest.fn(async () => configuracao),
    atualizarConfiguracao: jest.fn(async () => ({ ...configuracao, metasBadgesHabilitados: true }))
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  return {
    controlador: new ControladorGamificacao(servico as never, auditoria as never),
    servico,
    auditoria
  };
}

describe('ControladorGamificacao configuracao', () => {
  it('deve auditar a leitura da configuracao do tenant autenticado', async () => {
    const { controlador, auditoria } = criarControlador();

    await controlador.obterConfiguracao(usuario, requisicao);

    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'gamificacao.configuracao.ler',
      recursoTipo: 'tenant_configuracao',
      recursoId: 'tenant-1'
    }));
  });

  it('deve auditar os recursos alterados no PATCH da configuracao', async () => {
    const { controlador, auditoria } = criarControlador();

    await controlador.atualizarConfiguracao(usuario, requisicao, { metasBadgesHabilitados: true });

    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'gamificacao.configuracao.atualizar',
      metadados: { metasBadgesHabilitados: true }
    }));
  });
});
