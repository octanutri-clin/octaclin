import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoMobile } from '../aplicacao/servico-mobile';
import { ControladorMobile } from './controlador-mobile';

describe('ControladorMobile', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-paciente-1',
    tenantId: 'tenant-1',
    papel: 'Patient',
    emailHash: 'hash-paciente',
    permissoes: []
  };
  const requisicao = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1'
  } as unknown as Request;

  it('propaga o usuario autenticado para todos os metodos do servico', async () => {
    const servico = {
      listarDiarioRapido: jest.fn().mockResolvedValue([]),
      registrarDiarioRapido: jest.fn().mockResolvedValue({ id: 'diario-1' }),
      listarArquivosMidia: jest.fn().mockResolvedValue([]),
      solicitarUploadMidia: jest.fn().mockResolvedValue({ arquivo: { id: 'arquivo-1' }, uploadUrl: 'https://upload.test' }),
      listarAcompanhantes: jest.fn().mockResolvedValue([]),
      criarAcompanhante: jest.fn().mockResolvedValue({ id: 'acompanhante-1' }),
      sincronizarLote: jest.fn().mockResolvedValue({ resultados: [] })
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const controlador = new ControladorMobile(
      servico as unknown as ServicoMobile,
      auditoria as unknown as ServicoAuditoria
    );
    const diario = { pacienteId: 'paciente-1', tipo: 'humor' as const, valor: { nivel: 4 } };
    const upload = {
      pacienteId: 'paciente-1',
      tipo: 'imagem' as const,
      mimeType: 'image/jpeg',
      tamanhoBytes: 100
    };
    const acompanhante = { pacienteId: 'paciente-1', nome: 'Contato', pin: '1234' };
    const lote = { itens: [{ idLocal: 'local-1', tipo: 'diario_rapido' as const, payload: diario }] };

    await controlador.listarDiarioRapido(usuario);
    await controlador.registrarDiarioRapido(usuario, requisicao, diario);
    await controlador.listarArquivosMidia(usuario);
    await controlador.solicitarUploadMidia(usuario, requisicao, upload);
    await controlador.listarAcompanhantes(usuario);
    await controlador.criarAcompanhante(usuario, requisicao, acompanhante);
    await controlador.sincronizarLote(usuario, requisicao, lote);

    expect(servico.listarDiarioRapido).toHaveBeenCalledWith('tenant-1', usuario);
    expect(servico.registrarDiarioRapido).toHaveBeenCalledWith('tenant-1', diario, usuario);
    expect(servico.listarArquivosMidia).toHaveBeenCalledWith('tenant-1', usuario);
    expect(servico.solicitarUploadMidia).toHaveBeenCalledWith('tenant-1', upload, usuario);
    expect(servico.listarAcompanhantes).toHaveBeenCalledWith('tenant-1', usuario);
    expect(servico.criarAcompanhante).toHaveBeenCalledWith('tenant-1', acompanhante, usuario);
    expect(servico.sincronizarLote).toHaveBeenCalledWith('tenant-1', lote, usuario);
  });
});
