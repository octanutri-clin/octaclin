import { ControladorComunicacoes } from './controlador-comunicacoes';

describe('ControladorComunicacoes', () => {
  it('deve listar canais operacionais sem configuracao sensivel', async () => {
    const servico = {
      listarCanais: jest.fn(async () => [
        {
          id: 'canal-1',
          tenantId: 'tenant-1',
          tipo: 'whatsapp',
          nome: 'WhatsApp',
          configuracao: { token: 'segredo', phoneNumberId: '123' },
          ativo: true
        }
      ])
    };
    const controlador = new ControladorComunicacoes(servico as never, {} as never);

    const resposta = await controlador.listarCanais({ tenantId: 'tenant-1' } as never);

    expect(resposta).toEqual([{ id: 'canal-1', tipo: 'whatsapp', nome: 'WhatsApp', ativo: true, configuracao: {} }]);
    expect(JSON.stringify(resposta)).not.toContain('segredo');
    expect(JSON.stringify(resposta)).not.toContain('tenant-1');
  });

  it('deve retornar e auditar o estado persistido depois do envio', async () => {
    const mensagemCriada = { id: 'mensagem-1', status: 'pendente' };
    const mensagemAtualizada = { id: 'mensagem-1', status: 'falhou' };
    const servico = {
      dispararMensagem: jest.fn(async () => mensagemCriada),
      publicarEventoNotificacao: jest.fn(async () => undefined),
      obterMensagem: jest.fn(async () => mensagemAtualizada)
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorComunicacoes(servico as never, auditoria as never);
    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1' } as never;

    const resposta = await controlador.dispararMensagem(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', payload: {} }
    );

    expect(resposta).toBe(mensagemAtualizada);
    expect(servico.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pacienteId: 'paciente-1' }),
      usuario
    );
    expect(servico.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-1');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ metadados: expect.objectContaining({ status: 'falhou' }) })
    );
  });
});
