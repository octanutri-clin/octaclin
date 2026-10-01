import { ConflictException, NotFoundException } from '@nestjs/common';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ControladorLgpdCliente } from '../apresentacao/controlador-lgpd-cliente';
import { ServicoLgpdCliente, validarFiltrosLgpdCliente } from './servico-lgpd-cliente';

function criarCenario() {
  const agora = new Date('2025-01-01T10:00:00.000Z');
  const eventos = [
    {
      id: 'pedido-a', tenantId: 'tenant-a', usuarioId: 'paciente-a',
      tipo: 'solicitacao_lgpd_retificacao', aceitoEm: agora,
      detalhesCriptografados: null,
      metadados: { protocolo: 'LGPD-A', pacienteId: 'paciente-a', detalhes: 'Corrigir contato.' }
    },
    {
      id: 'pedido-b', tenantId: 'tenant-b', usuarioId: 'paciente-b',
      tipo: 'solicitacao_lgpd_exclusao', aceitoEm: agora,
      detalhesCriptografados: null,
      metadados: { protocolo: 'LGPD-B', pacienteId: 'paciente-b', detalhes: 'Excluir cadastro.' }
    }
  ];
  const consultas: { sql: string; parametros: unknown[] }[] = [];
  const esperaLock: Array<() => void> = [];
  let ocupado = false;
  const executorTenant = {
    executar: jest.fn(async (tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => {
      let lockAdquirido = false;
      const gerenciador = {
        query: jest.fn(async (sql: string, parametros: unknown[]) => {
          consultas.push({ sql, parametros });
          expect(parametros[0]).toBe(tenantId);
          const protocolo = parametros[1];
          if (sql.includes('limit 1 for update')) {
            if (ocupado) await new Promise<void>((resolver) => esperaLock.push(resolver));
            ocupado = true;
            lockAdquirido = true;
            const pedido = eventos.find((item) => item.tenantId === tenantId &&
              item.metadados.protocolo === protocolo && item.tipo.startsWith('solicitacao_lgpd_'));
            return pedido ? [{ id: pedido.id }] : [];
          }
          if (sql.includes('limit $4 offset $5')) {
            const pedidos = eventos.filter((item) => item.tenantId === tenantId && item.tipo.startsWith('solicitacao_lgpd_'));
            return pedidos.map((item) => ({
              protocolo: item.metadados.protocolo, tipo: item.tipo.replace('solicitacao_lgpd_', ''),
              status: eventos.some((evento) => evento.tenantId === tenantId && evento.tipo === 'tratativa_lgpd' &&
                evento.metadados.protocolo === item.metadados.protocolo) ? 'em_tratamento' : 'recebida',
              abertoEm: item.aceitoEm, atualizadoEm: item.aceitoEm, possuiDetalhes: true
            }));
          }
          return eventos.filter((item) => item.tenantId === tenantId && item.metadados.protocolo === protocolo)
            .sort((a, b) => a.aceitoEm.getTime() - b.aceitoEm.getTime());
        }),
        getRepository: jest.fn(() => ({
          create: (dados: Record<string, unknown>) => dados,
          save: async (dados: Record<string, unknown>) => {
            eventos.push({
              id: 'tratativa-a', tenantId: dados.tenantId as string, usuarioId: dados.usuarioId as string,
              tipo: dados.tipo as string, aceitoEm: dados.aceitoEm as Date,
              detalhesCriptografados: null,
              metadados: dados.metadados as typeof eventos[number]['metadados']
            });
            return dados;
          }
        }))
      };
      try {
        return await operacao(gerenciador);
      } finally {
        if (lockAdquirido) {
          ocupado = false;
          esperaLock.shift()?.();
        }
      }
    })
  };
  return {
    servico: new ServicoLgpdCliente(executorTenant as never, new CriptografiaDadosSensiveis()),
    eventos,
    consultas,
    executorTenant
  };
}

describe('ServicoLgpdCliente', () => {
  it('limita as rotas ao gestor Client com cliente.acessar', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorLgpdCliente)).toEqual(['Client']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorLgpdCliente)).toEqual(['cliente.acessar']);
  });

  it('nao revela pedido de outro tenant no detalhe nem na fila', async () => {
    const { servico, consultas, executorTenant } = criarCenario();
    await expect(servico.obterDetalhe('tenant-a', 'LGPD-B')).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.assumirTratativa('tenant-a', 'gestor-a', 'LGPD-B')).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.listar('tenant-a')).resolves.toEqual(expect.objectContaining({
      itens: [expect.objectContaining({ protocolo: 'LGPD-A' })]
    }));
    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-a', expect.any(Function));
    expect(consultas.every((consulta) => consulta.parametros[0] === 'tenant-a')).toBe(true);
  });

  it('rejeita filtros e protocolo invalidos antes de consultar dados', async () => {
    const { servico, executorTenant } = criarCenario();
    expect(() => validarFiltrosLgpdCliente({ limite: '51' })).toThrow();
    expect(() => validarFiltrosLgpdCliente({ tenantId: 'tenant-b' })).toThrow();
    await expect(servico.obterDetalhe('tenant-a', 'LGPD-A\n')).rejects.toThrow();
    expect(executorTenant.executar).not.toHaveBeenCalled();
  });

  it('serializa duas triagens e registra apenas um evento de inicio', async () => {
    const { servico, eventos, consultas } = criarCenario();
    const [primeira, segunda] = await Promise.all([
      servico.assumirTratativa('tenant-a', 'gestor-a', 'LGPD-A'),
      servico.assumirTratativa('tenant-a', 'gestor-b', 'LGPD-A')
    ]);
    expect([primeira.jaEmTratamento, segunda.jaEmTratamento].sort()).toEqual([false, true]);
    expect(eventos.filter((evento) => evento.tipo === 'tratativa_lgpd')).toHaveLength(1);
    expect(consultas.filter((consulta) => consulta.sql.includes('for update'))).toHaveLength(2);
    expect(JSON.stringify(primeira)).not.toContain('paciente-a');
  });

  it('impede triagem de pedido com decisao final e nao envia o rascunho', async () => {
    const { servico, eventos } = criarCenario();
    eventos.push({
      id: 'decisao', tenantId: 'tenant-a', usuarioId: 'superadmin', tipo: 'tratativa_lgpd',
      aceitoEm: new Date('2025-01-01T11:00:00.000Z'), detalhesCriptografados: null,
      metadados: { protocolo: 'LGPD-A', pacienteId: 'paciente-a', status: 'concluida' } as never
    });
    await expect(servico.assumirTratativa('tenant-a', 'gestor-a', 'LGPD-A')).rejects.toBeInstanceOf(ConflictException);
    await expect(servico.prepararResposta('tenant-a', 'LGPD-A')).rejects.toBeInstanceOf(ConflictException);
    expect(eventos.filter((evento) => evento.tipo === 'tratativa_lgpd')).toHaveLength(1);
  });
});
