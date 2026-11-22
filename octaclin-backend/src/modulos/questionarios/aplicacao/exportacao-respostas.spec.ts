import { randomUUID } from 'crypto';
import { ServicoQuestionarios } from './servico-questionarios';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

describe('QPRO-01 — escopo do CSV de respostas', () => {
  const tenant = randomUUID(), profissional = randomUUID(), paciente = randomUUID();
  const questionario = randomUUID(), a = randomUUID(), b = randomUUID(), envio = randomUUID(), pergunta = randomUUID();
  const ator: UsuarioAutenticado = { tenantId: tenant, usuarioId: randomUUID(), papel: 'Professional', emailHash: 'sintetico', permissoes: ['questionarios.ler'] };
  function preparar(permitido = true) {
    const leiturasEnvio = jest.fn(async () => [{ id: envio, questionarioId: questionario }]);
    const valores = jest.fn(async () => [
      { respostaCheckinId: a, perguntaId: pergunta, valor: 0 },
      { respostaCheckinId: b, perguntaId: pergunta, valor: false }
    ]);
    const entidades: Record<string, object> = {
      ProfissionalOrm: { findOne: async () => ({ id: profissional }) },
      QuestionarioOrm: { findOne: async () => ({ id: questionario, profissionalId: profissional }) },
      EnvioQuestionarioOrm: { find: leiturasEnvio },
      RespostaCheckinOrm: { find: async (consulta: { where: { id?: { value: string[] } } }) => [a, b]
        .filter(id => !consulta.where.id || consulta.where.id.value.includes(id))
        .map(id => ({ id, pacienteId: paciente, envioQuestionarioId: envio, finalizadoEm: new Date('2026-11-20T12:00:00Z') })) },
      PerguntaOrm: { find: async () => [{ id: pergunta, enunciado: 'Resposta sintética', tipo: 'texto_longo' }] },
      RespostaValorOrm: { find: valores }
    };
    const query = jest.fn(async () => permitido ? [{ id: paciente }] : []);
    const manager = { getRepository: (tipo: { name: string }) => entidades[tipo.name], query };
    const servico = new ServicoQuestionarios({ executar: async (_t: string, fn: (m: unknown) => unknown) => fn(manager) } as never);
    const exportar = (ids?: unknown) => Reflect.apply(servico.exportarRespostasCsv, servico, [tenant, questionario, ator, ids]);
    return { servico, exportar, valores, query, leiturasEnvio };
  }
  test('exportação filtrada contém somente a seleção e preserva zero', async () => {
    const { exportar } = preparar();
    const csv = await exportar([a]);
    expect(csv).toContain(a);
    expect(csv).not.toContain(b);
    expect(csv).toContain('0');
  });
  test('exportação completa legada continua incluindo ambas as respostas', async () => {
    const csv = await preparar().exportar();
    expect(csv).toContain(a); expect(csv).toContain(b);
  });
  test('ID desconhecido não expande a seleção nem produz arquivo parcial', async () => {
    await expect(preparar().exportar([a, randomUUID()])).rejects.toThrow();
  });
  test('acesso revogado impede leitura dos valores e exportação', async () => {
    const { exportar, valores } = preparar(false);
    await expect(exportar([a])).rejects.toThrow();
    expect(valores).not.toHaveBeenCalled();
  });
  test('negativa de acesso não lê snapshots ou rascunhos antecipadamente', async () => {
    const { exportar, leiturasEnvio } = preparar(false);
    await expect(exportar([a])).rejects.toThrow();
    expect(leiturasEnvio).toHaveBeenCalledTimes(1);
    expect(leiturasEnvio).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }));
  });
  test.each([[], [a, a], ['invalido'], Array.from({ length: 1001 }, () => randomUUID())].map(ids => ({ ids })))('seleção inválida é rejeitada (%#)', async ({ ids }) => {
    await expect(preparar().exportar(ids)).rejects.toThrow();
  });
});
