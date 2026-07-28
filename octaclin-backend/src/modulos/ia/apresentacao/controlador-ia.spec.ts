import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoIa } from '../aplicacao/servico-ia';
import { ControladorIa } from './controlador-ia';

describe('ControladorIa', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-profissional-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash-profissional',
    permissoes: ['ia.executar']
  };
  const requisicao = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1'
  } as unknown as Request;

  it('propaga o usuario autenticado para todos os metodos do servico', async () => {
    const servico = {
      listarAnalisesSentimento: jest.fn().mockResolvedValue([]),
      analisarSentimento: jest.fn().mockResolvedValue({ id: 'sentimento-1', alertaDisparado: false }),
      listarReconhecimentosAlimentares: jest.fn().mockResolvedValue([]),
      reconhecerAlimento: jest.fn().mockResolvedValue({
        id: 'reconhecimento-1',
        alimentosDetectados: []
      })
    };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const controlador = new ControladorIa(
      servico as unknown as ServicoIa,
      auditoria as unknown as ServicoAuditoria
    );
    const sentimento = { pacienteId: 'paciente-1', texto: 'texto clinico' };
    const reconhecimento = {
      pacienteId: 'paciente-1',
      arquivoMidiaId: 'midia-1',
      imagemUrl: 'https://example.com/prato.jpg'
    };

    await controlador.listarAnalisesSentimento(usuario);
    await controlador.analisarSentimento(usuario, requisicao, sentimento);
    await controlador.listarReconhecimentosAlimentares(usuario);
    await controlador.reconhecerAlimento(usuario, requisicao, reconhecimento);

    expect(servico.listarAnalisesSentimento).toHaveBeenCalledWith('tenant-1', usuario);
    expect(servico.analisarSentimento).toHaveBeenCalledWith('tenant-1', sentimento, usuario);
    expect(servico.listarReconhecimentosAlimentares).toHaveBeenCalledWith('tenant-1', usuario);
    expect(servico.reconhecerAlimento).toHaveBeenCalledWith('tenant-1', reconhecimento, usuario);
  });
});
