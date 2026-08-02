import { createHash } from 'crypto';
import type { Request } from 'express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
import { ServicoMobile } from '../../mobile/aplicacao/servico-mobile';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ControladorFormulariosPublicos } from './controlador-formularios-publicos';

describe('ControladorFormulariosPublicos', () => {
  it.each(['rascunho', 'respostas'] as const)('limita a escrita publica de %s sem expor o token', async (acao) => {
    const token = 'tenant.envio.assinatura-secreta';
    const servico = {
      salvarRascunhoFormularioPaciente: jest.fn(async () => ({ versao: 1 })),
      finalizarFormularioPaciente: jest.fn(async () => ({ status: 'respondido' }))
    } as unknown as ServicoQuestionarios;
    const protecaoAbuso = {
      consumirTentativa: jest.fn(async () => undefined)
    } as unknown as ServicoProtecaoAbuso;
    const controlador = new ControladorFormulariosPublicos(servico, protecaoAbuso, {} as ServicoMobile, {} as ServicoAuditoria);
    const requisicao = { ip: '203.0.113.10' } as Request;

    if (acao === 'rascunho') await controlador.salvarRascunho(token, { versaoBase: 0, respostas: [] }, requisicao);
    else await controlador.finalizarFormulario(token, { respostas: [] }, requisicao);

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      `formulario_publico:escrita:203.0.113.10:${createHash('sha256').update(token).digest('hex')}`,
      expect.objectContaining({ maxTentativas: 120 })
    );
    expect(JSON.stringify((protecaoAbuso.consumirTentativa as jest.Mock).mock.calls)).not.toContain(token);
  });

  it('vincula upload publico ao paciente e pergunta definidos pelo token', async () => {
    const servico = {
      obterContextoFormularioPaciente: jest.fn(async () => ({
        tenantId: 'tenant-1',
        envioId: 'envio-1',
        pacienteId: 'paciente-1',
        perguntas: [{ id: 'pergunta-1', tipo: 'upload_midia', configuracao: { tiposAceitos: ['application/pdf'] } }]
      }))
    } as unknown as ServicoQuestionarios;
    const protecaoAbuso = { consumirTentativa: jest.fn(async () => undefined) } as unknown as ServicoProtecaoAbuso;
    const mobile = {
      solicitarUploadMidiaFormularioPublico: jest.fn(async () => ({ arquivo: { id: 'arquivo-1' }, uploadUrl: 'https://upload.example' }))
    } as unknown as ServicoMobile;
    const auditoria = { registrar: jest.fn(async () => undefined) } as unknown as ServicoAuditoria;
    const controlador = new ControladorFormulariosPublicos(servico, protecaoAbuso, mobile, auditoria);

    const resposta = await controlador.solicitarUpload(
      'token-seguro',
      { perguntaId: 'pergunta-1', nomeArquivo: 'exame.pdf', mimeType: 'application/pdf', tamanhoBytes: 1024 },
      { ip: '203.0.113.10', headers: {} } as Request
    );

    expect(mobile.solicitarUploadMidiaFormularioPublico).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pacienteId: 'paciente-1', tipo: 'documento', categoria: 'exame' }),
      { envioid: 'envio-1', perguntaid: 'pergunta-1' }
    );
    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      expect.stringContaining('formulario_publico:upload:203.0.113.10:'),
      expect.objectContaining({ maxTentativas: 10 })
    );
    expect(resposta).toEqual(expect.objectContaining({ arquivo: { id: 'arquivo-1' } }));
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'formulario_publico.anexo.solicitar' }));
  });
});
