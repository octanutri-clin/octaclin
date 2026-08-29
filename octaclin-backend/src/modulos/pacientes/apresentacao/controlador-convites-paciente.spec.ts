import { createHash } from 'crypto';
import type { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ServicoConvitesPaciente } from '../aplicacao/servico-convites-paciente';
import { ControladorConvitesPaciente } from './controlador-convites-paciente';

describe('ControladorConvitesPaciente - rotas publicas', () => {
  const criarControlador = () => {
    const servico = {
      obterConvitePublico: jest.fn(async () => ({ valido: true })),
      ativarConvite: jest.fn(async () => ({ ativado: true }))
    } as unknown as ServicoConvitesPaciente;
    const protecao = { consumirTentativa: jest.fn(async () => undefined) } as unknown as ServicoProtecaoAbuso;
    return {
      controlador: new ControladorConvitesPaciente(servico, {} as ServicoAuditoria, protecao),
      protecao
    };
  };

  it('limita leitura globalmente e pelo hash do convite sem expor o token', async () => {
    const token = 'convite-sintetico-secreto';
    const { controlador, protecao } = criarControlador();

    await controlador.obterConvite(token, { ip: '203.0.113.10' } as Request);

    expect(protecao.consumirTentativa).toHaveBeenNthCalledWith(
      1,
      'convite_paciente:consulta:203.0.113.10',
      expect.any(Object)
    );
    expect(protecao.consumirTentativa).toHaveBeenNthCalledWith(
      2,
      `convite_paciente:consulta:203.0.113.10:${createHash('sha256').update(token).digest('hex')}`,
      expect.any(Object)
    );
    expect(JSON.stringify((protecao.consumirTentativa as jest.Mock).mock.calls)).not.toContain(token);
  });

  it('limita ativacao globalmente e pelo hash do convite', async () => {
    const token = 'convite-sintetico-secreto';
    const { controlador, protecao } = criarControlador();

    await controlador.ativarConvite(
      {
        token,
        senha: 'SenhaSintetica123!',
        aceiteLgpd: true,
        aceiteTermosUso: true,
        aceitePoliticaPrivacidade: true
      },
      { ip: '203.0.113.10' } as Request
    );

    expect(protecao.consumirTentativa).toHaveBeenNthCalledWith(
      1,
      'convite_paciente:ativacao:203.0.113.10',
      expect.any(Object)
    );
    expect(protecao.consumirTentativa).toHaveBeenNthCalledWith(
      2,
      `convite_paciente:ativacao:203.0.113.10:${createHash('sha256').update(token).digest('hex')}`,
      expect.any(Object)
    );
  });
});
