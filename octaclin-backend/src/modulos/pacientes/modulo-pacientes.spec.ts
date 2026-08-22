import { MODULE_METADATA } from '@nestjs/common/constants';
import { ControladorFiltrosSalvosPacientes } from './apresentacao/controlador-filtros-salvos-pacientes';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
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
});
