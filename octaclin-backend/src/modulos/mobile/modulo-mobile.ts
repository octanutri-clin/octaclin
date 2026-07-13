import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoMobile } from './aplicacao/servico-mobile';
import { ControladorMobile } from './apresentacao/controlador-mobile';
import { AcompanhanteOrm } from './infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from './infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from './infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from './infraestrutura/sincronizacao-mobile.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([LogDiarioRapidoOrm, ArquivoMidiaOrm, AcompanhanteOrm, SincronizacaoMobileOrm, UserActionLogOrm]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorMobile],
  providers: [ServicoMobile, CriptografiaDadosSensiveis, ServicoSenhas, ServicoAuditoria],
  exports: [ServicoMobile]
})
export class ModuloMobile {}
