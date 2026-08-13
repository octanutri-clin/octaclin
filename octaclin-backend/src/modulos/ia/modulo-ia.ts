import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { ServicoArmazenamentoObjetos } from '../../infraestrutura/armazenamento/servico-armazenamento-objetos';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ArquivoMidiaOrm } from '../mobile/infraestrutura/arquivo-midia.orm';
import { RespostaCheckinOrm } from '../questionarios/infraestrutura/resposta-checkin.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoIa } from './aplicacao/servico-ia';
import { ControladorIa } from './apresentacao/controlador-ia';
import { AnaliseSentimentoOrm } from './infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from './infraestrutura/reconhecimento-alimentar.orm';
import { TranscricaoMidiaOrm } from './infraestrutura/transcricao-midia.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnaliseSentimentoOrm,
      ReconhecimentoAlimentarOrm,
      TranscricaoMidiaOrm,
      RespostaCheckinOrm,
      ArquivoMidiaOrm,
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorIa],
  providers: [ServicoIa, ServicoAuditoria, ServicoArmazenamentoObjetos],
  exports: [ServicoIa]
})
export class ModuloIa {}
