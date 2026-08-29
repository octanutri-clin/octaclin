import { NotFoundException } from '@nestjs/common';
import { SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { ServicoSessoes } from './servico-sessoes';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USUARIO = '11111111-1111-4111-8111-111111111111';

function criarAmbiente(sessoes: Partial<SessaoUsuarioOrm>[] = []) {
  const linhas = sessoes.map((sessao) => ({ ...sessao })) as SessaoUsuarioOrm[];
  const repositorioSessoes = {
    find: jest.fn(async () => linhas),
    findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
      linhas.find((linha) => linha.id === where.id) ?? null
    ),
    update: jest.fn(async () => ({ affected: 1 })),
    save: jest.fn(async (entrada: unknown) => entrada),
    create: jest.fn((entrada: unknown) => entrada)
  };
  const repositorioTokens = { update: jest.fn(async () => ({ affected: 2 })) };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) =>
      entidade === SessaoUsuarioOrm ? repositorioSessoes : repositorioTokens
    )
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const auditoria = { registrar: jest.fn(async (_entrada: Record<string, unknown>) => undefined) };

  return {
    servico: new ServicoSessoes(executorTenant as never, auditoria as never),
    repositorioSessoes,
    repositorioTokens,
    auditoria
  };
}

function sessao(id: string, extra: Partial<SessaoUsuarioOrm> = {}): Partial<SessaoUsuarioOrm> {
  return {
    id,
    tenantId: TENANT,
    usuarioId: USUARIO,
    criadoEm: new Date('2026-08-01T10:00:00.000Z'),
    ultimaAtividadeEm: new Date('2026-08-01T11:00:00.000Z'),
    expiraEm: new Date('2126-08-01T10:00:00.000Z'),
    revogadoEm: null,
    motivoRevogacao: null,
    ...extra
  };
}

describe('ServicoSessoes', () => {
  const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  describe('referencia publica', () => {
    it('nao devolve o identificador da sessao nem prefixo dele', () => {
      const { servico } = criarAmbiente();
      const referencia = servico.referenciaPublica(ID_A);

      expect(referencia).not.toContain(ID_A);
      expect(ID_A).not.toContain(referencia);
      expect(referencia).toMatch(/^[0-9a-f]{32}$/);
    });

    it('e estavel para a mesma sessao e distinta entre sessoes', () => {
      const { servico } = criarAmbiente();

      expect(servico.referenciaPublica(ID_A)).toBe(servico.referenciaPublica(ID_A));
      expect(servico.referenciaPublica(ID_A)).not.toBe(servico.referenciaPublica(ID_B));
    });
  });

  describe('listagem', () => {
    it('devolve somente metadados minimos e marca a sessao atual', async () => {
      const { servico } = criarAmbiente([sessao(ID_A), sessao(ID_B)]);

      const lista = await servico.listar(TENANT, USUARIO, ID_B);

      expect(lista).toHaveLength(2);
      expect(Object.keys(lista[0]).sort()).toEqual(
        ['atual', 'criadaEm', 'estado', 'expiraEm', 'referencia', 'ultimaAtividadeEm'].sort()
      );
      expect(lista.find((item) => item.atual)?.referencia).toBe(servico.referenciaPublica(ID_B));
    });

    it('nao expoe token, hash, family id, usuario nem tenant', async () => {
      const { servico } = criarAmbiente([sessao(ID_A)]);

      const serializado = JSON.stringify(await servico.listar(TENANT, USUARIO, ID_A));

      expect(serializado).not.toContain(ID_A);
      expect(serializado).not.toContain(TENANT);
      expect(serializado).not.toContain(USUARIO);
      expect(serializado).not.toMatch(/hash|token|familia/i);
    });

    it('classifica revogada e expirada', async () => {
      const { servico } = criarAmbiente([
        sessao(ID_A, { revogadoEm: new Date('2026-08-02T10:00:00.000Z'), motivoRevogacao: 'logout' }),
        sessao(ID_B, { expiraEm: new Date('2020-01-01T00:00:00.000Z') })
      ]);

      const lista = await servico.listar(TENANT, USUARIO, 'outra');

      expect(lista.map((item) => item.estado).sort()).toEqual(['expirada', 'revogada']);
    });

    it('restringe a consulta ao tenant e ao usuario da credencial', async () => {
      const { servico, repositorioSessoes } = criarAmbiente([sessao(ID_A)]);

      await servico.listar(TENANT, USUARIO, ID_A);

      expect(repositorioSessoes.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT, usuarioId: USUARIO }) })
      );
    });
  });

  describe('encerramento', () => {
    it('encerra a sessao propria localizada pela referencia', async () => {
      const { servico, repositorioSessoes, repositorioTokens } = criarAmbiente([sessao(ID_A), sessao(ID_B)]);

      await servico.encerrarPorReferencia(TENANT, USUARIO, servico.referenciaPublica(ID_B));

      expect(repositorioSessoes.update).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT, usuarioId: USUARIO, id: ID_B }),
        expect.objectContaining({ motivoRevogacao: 'encerrada_pelo_usuario' })
      );
      expect(repositorioTokens.update).toHaveBeenCalled();
    });

    it('recusa referencia que nao pertence ao usuario', async () => {
      const { servico, repositorioSessoes } = criarAmbiente([sessao(ID_A)]);

      await expect(
        servico.encerrarPorReferencia(TENANT, USUARIO, servico.referenciaPublica(ID_B))
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repositorioSessoes.update).not.toHaveBeenCalled();
    });

    it('encerra as demais sessoes preservando a atual', async () => {
      const { servico, repositorioSessoes } = criarAmbiente([sessao(ID_A), sessao(ID_B)]);

      const encerradas = await servico.encerrarOutras(TENANT, USUARIO, ID_A);

      expect(encerradas).toBe(1);
      expect(repositorioSessoes.update).toHaveBeenCalledTimes(1);
      expect(repositorioSessoes.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: ID_B }),
        expect.objectContaining({ motivoRevogacao: 'encerrada_outras' })
      );
    });
  });

  describe('auditoria de reuso', () => {
    it('registra a deteccao sem token, hash ou referencia derivada', async () => {
      const { servico, auditoria } = criarAmbiente([sessao(ID_A)]);

      await servico.revogarPorReuso(TENANT, USUARIO, ID_A);

      const registro = auditoria.registrar.mock.calls[0][0];
      expect(registro.acao).toBe('auth.sessao.reuso_detectado');
      expect(JSON.stringify(registro)).not.toMatch(/hash|refreshToken|tokenHash/i);
    });
  });
});
