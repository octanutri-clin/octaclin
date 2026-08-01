import { createHash } from 'crypto';
import type { Request } from 'express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
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
    const controlador = new ControladorFormulariosPublicos(servico, protecaoAbuso);
    const requisicao = { ip: '203.0.113.10' } as Request;

    if (acao === 'rascunho') await controlador.salvarRascunho(token, { versaoBase: 0, respostas: [] }, requisicao);
    else await controlador.finalizarFormulario(token, { respostas: [] }, requisicao);

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      `formulario_publico:escrita:203.0.113.10:${createHash('sha256').update(token).digest('hex')}`,
      expect.objectContaining({ maxTentativas: 120 })
    );
    expect(JSON.stringify((protecaoAbuso.consumirTentativa as jest.Mock).mock.calls)).not.toContain(token);
  });
});
