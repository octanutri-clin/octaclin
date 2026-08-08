import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('pronto')
  async verificarPronto(@Res({ passthrough: true }) respostaHttp: Response) {
    const health = await this.servicoSaude.verificarDetalhado();
    const pronto = health.checks.banco.status === 'ok' && health.checks.migracoes.status === 'ok';
    respostaHttp.status(pronto ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: pronto ? ('ok' as const) : ('falha' as const),
      servico: health.servico,
      horario: health.horario,
      checks: {
        banco: health.checks.banco,
        migracoes: health.checks.migracoes
      }
    };
  }
}
