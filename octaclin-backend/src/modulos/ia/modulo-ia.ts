import { catalogoTecnicoPiloto318 } from './dominio/catalogo-piloto318';
import { ControladorPilotoSintetico318 } from './apresentacao/controlador-piloto-sintetico318';
import { ServicoPilotoSintetico318, POLITICA_PILOTO318, PROVIDER_PILOTO318, DIREITOS_PILOTO318_APROVADOS, PoliticaPiloto318 } from './aplicacao/servico-piloto-sintetico318';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ConteudoRascunhos318, DIREITOS_IA318, MODELOS_IA318, DIREITOS_BYOK318_APROVADOS, catalogoClinico318 } from './dominio/rascunhos-clinicos';
import { ContextoRascunhos318 } from './aplicacao/contexto-rascunhos318';
import { ServicoRascunhosClinicosIa } from './aplicacao/servico-rascunhos-clinicos';
import { AdaptadorOpenAi318 } from './infraestrutura/adaptador-openai318';
import { ControladorRascunhos318, ControladorConfigRascunhos318, ControladorOperacoesRascunhos318 } from './apresentacao/controlador-rascunhos318';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
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
  controllers: [ControladorPilotoSintetico318, ControladorIa, ControladorRascunhos318, ControladorConfigRascunhos318, ControladorOperacoesRascunhos318],
  providers: [ServicoPilotoSintetico318, { provide: POLITICA_PILOTO318, useFactory: ():PoliticaPiloto318 => ({ativo:process.env.IA318_PILOTO_SINTETICO_ATIVO==='true',direitos:DIREITOS_PILOTO318_APROVADOS,modelos:catalogoTecnicoPiloto318()}) }, {provide:PROVIDER_PILOTO318, inject:[POLITICA_PILOTO318], useFactory:(p:PoliticaPiloto318)=>new AdaptadorOpenAi318(p.modelos,p.direitos)}, ServicoIa, ServicoAuditoria, CriptografiaDadosSensiveis, ConteudoRascunhos318, ContextoRascunhos318, ServicoRascunhosClinicosIa, AdaptadorOpenAi318, {provide: DIREITOS_IA318, useValue: DIREITOS_BYOK318_APROVADOS}, {provide: MODELOS_IA318, useFactory: catalogoClinico318}],
  exports: [ServicoIa]
})
export class ModuloIa {}
