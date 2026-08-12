import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { ServicoArmazenamentoObjetos } from '../../infraestrutura/armazenamento/servico-armazenamento-objetos';
import { ModuloAuth } from '../auth/modulo-auth';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { ModuloClientes } from '../clientes/modulo-clientes';
import { AvaliacaoAntropometricaOrm } from '../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { DocumentoEmitidoOrm } from '../pacientes/infraestrutura/documento-emitido.orm';
import { ConsentimentoEvolucaoFotograficaOrm } from '../pacientes/infraestrutura/consentimento-evolucao-fotografica.orm';
import { EvolucaoFotograficaArquivoOrm } from '../pacientes/infraestrutura/evolucao-fotografica-arquivo.orm';
import { EvolucaoFotograficaOrm } from '../pacientes/infraestrutura/evolucao-fotografica.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoMobile } from './aplicacao/servico-mobile';
import { ControladorMobile } from './apresentacao/controlador-mobile';
import { AcompanhanteOrm } from './infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from './infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from './infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from './infraestrutura/sincronizacao-mobile.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LogDiarioRapidoOrm,
      ArquivoMidiaOrm,
      AcompanhanteOrm,
      SincronizacaoMobileOrm,
      UserActionLogOrm,
      AgendaConsultaOrm,
      AvaliacaoAntropometricaOrm,
      DocumentoEmitidoOrm
      ,ConsentimentoEvolucaoFotograficaOrm
      ,EvolucaoFotograficaOrm
      ,EvolucaoFotograficaArquivoOrm
    ]),
    ModuloAuth,
    ModuloClientes,
    ModuloTenancy
  ],
  controllers: [ControladorMobile],
  providers: [ServicoMobile, CriptografiaDadosSensiveis, ServicoSenhas, ServicoAuditoria, ServicoArmazenamentoObjetos],
  exports: [ServicoMobile]
})
export class ModuloMobile {}
