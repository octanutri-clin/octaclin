import { BadRequestException } from '@nestjs/common';
import { ServicoLembretesAcompanhamento } from './servico-lembretes-acompanhamento';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';

function cenario(valor?: Record<string, unknown>) {
  const linha = valor ? { id: 'config-a', tenantId: 'tenant-a', chave: 'lembretes_acompanhamento', valor } : null;
  const repo = {
    findOne: jest.fn(async () => linha),
    create: jest.fn((dados) => dados),
    save: jest.fn(async (dados) => dados)
  };
  const gerenciador = { query: jest.fn(async () => []), getRepository: jest.fn((entidade) => entidade === TenantConfiguracaoOrm ? repo : undefined) };
  const executor = { executar: jest.fn(async (_tenant, fn) => fn(gerenciador)) };
  const servico = new ServicoLembretesAcompanhamento(executor as never);
  return { servico, repo, gerenciador, executor };
}

describe('ServicoLembretesAcompanhamento', () => {
  it('começa desligado em cada tenant, sem campanha retroativa', async () => {
    const { servico, repo, executor } = cenario();
    expect(await servico.obter('tenant-a')).toEqual({
      plano: { ativo: false, intervaloDias: 7 }, tarefas: { ativo: false, antecedenciaHoras: 24 }
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', chave: 'lembretes_acompanhamento' } });
    expect(executor.executar).toHaveBeenCalledWith('tenant-a', expect.any(Function));
  });

  it('ativa somente para recursos novos e persiste configuração no tenant', async () => {
    const { servico, repo } = cenario();
    const agora = new Date('2026-09-30T18:00:00Z');
    const resultado = await servico.atualizar('tenant-a', {
      plano: { ativo: true, intervaloDias: 14 }, tarefas: { ativo: true, antecedenciaHoras: 12 }
    }, agora);
    expect(resultado.plano.ativadoEm).toEqual(agora);
    expect(resultado.tarefas.ativadoEm).toEqual(agora);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', chave: 'lembretes_acompanhamento',
      valor: expect.objectContaining({ plano: expect.objectContaining({ intervaloDias: 14 }), tarefas: expect.objectContaining({ antecedenciaHoras: 12 }) })
    }));
  });

  it('não reinicia ativação sem mudança e reinicia quando a cadência muda', async () => {
    const anterior = '2026-09-29T10:00:00.000Z';
    const { servico } = cenario({ plano: { ativo: true, intervaloDias: 7, ativadoEm: anterior }, tarefas: { ativo: false, antecedenciaHoras: 24 } });
    const agora = new Date('2026-09-30T18:00:00Z');
    const igual = await servico.atualizar('tenant-a', { plano: { ativo: true, intervaloDias: 7 }, tarefas: { ativo: false, antecedenciaHoras: 24 } }, agora);
    expect(igual.plano.ativadoEm).toEqual(new Date(anterior));
    const mudou = await servico.atualizar('tenant-a', { plano: { ativo: true, intervaloDias: 8 }, tarefas: { ativo: false, antecedenciaHoras: 24 } }, agora);
    expect(mudou.plano.ativadoEm).toEqual(agora);
  });

  it('recusa intervalo e antecedência inválidos mesmo sem validação HTTP', async () => {
    const { servico } = cenario();
    await expect(servico.atualizar('tenant-a', { plano: { ativo: true, intervaloDias: 0 }, tarefas: { ativo: false, antecedenciaHoras: 24 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.atualizar('tenant-a', { plano: { ativo: false, intervaloDias: 7 }, tarefas: { ativo: true, antecedenciaHoras: 169 } })).rejects.toBeInstanceOf(BadRequestException);
  });
});
