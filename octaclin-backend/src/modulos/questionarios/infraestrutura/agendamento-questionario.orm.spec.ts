import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { AgendamentoQuestionarioOrm } from './agendamento-questionario.orm';

describe('agendamento: controle editorial e autorização atual', () => {
  const coluna = (nome: string) => getMetadataArgsStorage().columns.find(
    c => c.target === AgendamentoQuestionarioOrm && c.propertyName === nome,
  )?.options;
  it('inicia revisão editorial positiva para CAS sem inventar autoria legada', () => {
    expect(coluna('revisao')).toMatchObject({ type: 'integer', default: 1 });
    expect(coluna('autorizadoPorUsuarioId')).toMatchObject({ type: 'uuid', nullable: true });
    expect(coluna('autorizadoPorUsuarioId')).not.toHaveProperty('default');
  });
  it('distingue pausa deliberada de encerramento e inatividade legada', () => {
    expect(coluna('pausadoEm')).toMatchObject({ type: 'timestamptz', nullable: true });
  });
});
