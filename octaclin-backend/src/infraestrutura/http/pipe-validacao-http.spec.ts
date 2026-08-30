import 'reflect-metadata';
import { type ArgumentMetadata } from '@nestjs/common';
import { DispararMensagemDto } from '../../modulos/comunicacoes/aplicacao/dtos';
import { AtualizarPacienteDto } from '../../modulos/pacientes/aplicacao/dtos';
import { AtualizarProfissionalDto } from '../../modulos/profissionais/aplicacao/dtos';
import { criarPipeValidacaoHttp } from './pipe-validacao-http';

const corpo = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
  data: undefined
});

describe('Pipe de validacao HTTP contra mass assignment', () => {
  it.each([
    {
      dto: AtualizarPacienteDto,
      payload: { nome: 'Paciente sintetico', tenantId: 'tenant-atacante' },
      campo: 'tenantId'
    },
    {
      dto: AtualizarProfissionalDto,
      payload: { nome: 'Profissional sintetico', usuarioId: 'usuario-atacante' },
      campo: 'usuarioId'
    },
    {
      dto: DispararMensagemDto,
      payload: {
        pacienteId: '11111111-1111-4111-8111-111111111111',
        canalId: '22222222-2222-4222-8222-222222222222',
        templateId: '33333333-3333-4333-8333-333333333333',
        payload: {},
        permissoes: ['operacoes.tenants.gerenciar']
      },
      campo: 'permissoes'
    }
  ])('rejeita o campo nao autorizado $campo em $dto.name', async ({ dto, payload, campo }) => {
    await expect(criarPipeValidacaoHttp().transform(payload, corpo(dto))).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([`property ${campo} should not exist`])
      })
    });
  });

  it('aceita e transforma somente os campos declarados pelo contrato', async () => {
    await expect(
      criarPipeValidacaoHttp().transform(
        { nome: 'Paciente sintetico', scoreRisco: 42 },
        corpo(AtualizarPacienteDto)
      )
    ).resolves.toBeInstanceOf(AtualizarPacienteDto);
  });
});
