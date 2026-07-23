import { Controller, Get } from '@nestjs/common';
import { ServicoSaude } from './servico-saude';

@Controller('health')
export class ControladorSaude {
  constructor(private readonly servicoSaude: ServicoSaude) {}

  @Get()
  verificar() {
    return {
      status: 'ok',
      servico: 'octaclin-backend',
      horario: new Date().toISOString()
    };
  }

  @Get('detalhado')
  verificarDetalhado() {
    return this.servicoSaude.verificarDetalhado();
  }
}
