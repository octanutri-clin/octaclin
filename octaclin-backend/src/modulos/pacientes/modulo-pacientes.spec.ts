import { MODULE_METADATA } from '@nestjs/common/constants';
import { ControladorFiltrosSalvosPacientes } from './apresentacao/controlador-filtros-salvos-pacientes';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
import { ServicoCompartilhamentoReceitas } from '../planos-alimentares/aplicacao/servico-compartilhamento-receitas';
import { ModuloPlanosAlimentares } from '../planos-alimentares/modulo-planos-alimentares';
import { ModuloPacientes } from './modulo-pacientes';

describe('ModuloPacientes.controllers', () => {
  it('registra ControladorFiltrosSalvosPacientes antes de ControladorPacientes', () => {
    // ControladorPacientes tem @Get(':id'); se ele vier antes, o Express casa
    // "filtros-salvos" com :id e GET /pacientes/filtros-salvos nunca alcanca
    // ControladorFiltrosSalvosPacientes. A ordem de registro e o comportamento.
    const controllers: unknown[] = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ModuloPacientes);
    const indiceFiltrosSalvos = controllers.indexOf(ControladorFiltrosSalvosPacientes);
    const indicePacientes = controllers.indexOf(ControladorPacientes);

    expect(indiceFiltrosSalvos).toBeGreaterThanOrEqual(0);
    expect(indicePacientes).toBeGreaterThanOrEqual(0);
    expect(indiceFiltrosSalvos).toBeLessThan(indicePacientes);
  });

  it('exporta o servico de compartilhamento de receitas para o portal do paciente', () => {
    const exports: unknown[] = Reflect.getMetadata(MODULE_METADATA.EXPORTS, ModuloPlanosAlimentares);

    expect(exports).toContain(ServicoCompartilhamentoReceitas);
  });
});
