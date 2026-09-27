import { ControladorComunicacoes } from './controlador-comunicacoes';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';

describe('ControladorComunicacoes', () => {
  it('exige gerenciar templates para instalar e editar, com tenant derivado da sessão', async () => {
    const servico = {
      instalarTemplatesIniciais: jest.fn(async () => ({ criados: [{ id: 'template-1' }] })),
      atualizarTemplate: jest.fn(async () => ({ id: 'template-1', nome: 'Editado', canal: 'email', aprovado: true }))
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorComunicacoes(servico as never, auditoria as never);
    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1' } as never;
    const requisicao = { ip: '127.0.0.1', headers: {} } as never;

    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorComunicacoes.prototype.instalarTemplatesIniciais)).toEqual(['comunicacoes.templates.gerenciar']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorComunicacoes.prototype.atualizarTemplate)).toEqual(['comunicacoes.templates.gerenciar']);
    await controlador.instalarTemplatesIniciais(usuario, requisicao);
    await controlador.atualizarTemplate(usuario, requisicao, 'template-1', {
      canal: 'email', nome: 'Editado', conteudo: { corpo: 'Texto' }, aprovado: true
    });
    expect(servico.instalarTemplatesIniciais).toHaveBeenCalledWith('tenant-1');
    expect(servico.atualizarTemplate).toHaveBeenCalledWith('tenant-1', 'template-1', expect.objectContaining({ nome: 'Editado' }));
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', acao: 'comunicacoes.template.editar' }));
  });
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
      expect.objectContaining({ metadados: expect.objectContaining({ status: 'falhou', ignorouOptOut: false }) })
    );
  });

  it('deve registrar na auditoria quando o disparo confirmou explicitamente o override de opt-out', async () => {
    const mensagemCriada = { id: 'mensagem-1', status: 'pendente' };
    const servico = {
      dispararMensagem: jest.fn(async () => mensagemCriada),
      publicarEventoNotificacao: jest.fn(async () => undefined),
      obterMensagem: jest.fn(async () => mensagemCriada)
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorComunicacoes(servico as never, auditoria as never);
    const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1' } as never;

    await controlador.dispararMensagem(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', payload: {}, ignorarOptOut: true }
    );

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ metadados: expect.objectContaining({ ignorouOptOut: true }) })
    );
  });
});
