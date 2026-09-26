import 'reflect-metadata';
import { validate } from 'class-validator';
import { EnviarMaterialLoteDto } from '../../materiais/aplicacao/dtos';
import { CriarEnviosQuestionarioLoteDto } from '../../questionarios/aplicacao/dtos';

const ids = Array.from({ length: 26 }, (_, indice) => `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`);

describe('SelecaoPacientesLoteDto', () => {
  it.each([EnviarMaterialLoteDto, CriarEnviosQuestionarioLoteDto])('aceita IDs unicos e rejeita lista vazia, repetida, excessiva ou invalida', async (Classe) => {
    const dados = new Classe();
    if (dados instanceof EnviarMaterialLoteDto) dados.materialId = ids[25];
    dados.pacienteIds = ids.slice(0, 2);
    expect(await validate(dados)).toHaveLength(0);
    for (const invalida of [[], [ids[0], ids[0]], ids, ['id-invalido']]) {
      dados.pacienteIds = invalida;
      expect(await validate(dados)).not.toHaveLength(0);
    }
  });
});
