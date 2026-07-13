import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class ControladorSaude {
  @Get()
  verificar() {
    return {
      status: 'ok',
      servico: 'octaclin-backend',
      horario: new Date().toISOString()
    };
  }
}
