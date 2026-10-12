import { ServicoExcecaoRetencaoPiloto } from './aplicacao/servico-excecao-retencao-piloto';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';
import { ProcessadorRetencaoPiloto } from './aplicacao/processador-retencao-piloto';
import { ServicoRetencaoPiloto } from './aplicacao/servico-retencao-piloto';
import { ControladorConsolePiloto, ControladorPortalPiloto } from './apresentacao/controladores-piloto';
import { ServicoModeracaoPiloto } from './aplicacao/servico-moderacao-piloto';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ConteudoPiloto, ContextoGamificacaoPiloto } from './aplicacao/contexto-piloto';
import { ServicoConquistasPiloto } from './aplicacao/servico-conquistas-piloto';
import { ServicoCirculosPiloto } from './aplicacao/servico-circulos-piloto';
import { ServicoPublicacoesPiloto } from './aplicacao/servico-publicacoes-piloto';
import { ComandoGamificacaoOrm } from './infraestrutura/comando-gamificacao.orm';
import { RevisaoPublicacaoOrm } from './infraestrutura/revisao-publicacao.orm';
import { DenunciaComunidadeOrm } from './infraestrutura/denuncia-comunidade.orm';
import { CurtidaComunidadeOrm } from './infraestrutura/curtida-comunidade.orm';
import { ComentarioComunidadeOrm } from './infraestrutura/comentario-comunidade.orm';
import { ConsentimentoConquistaOrm } from './infraestrutura/consentimento-conquista.orm';
import { ServicoConfiguracaoPiloto } from './aplicacao/servico-configuracao-piloto';
import { ControladorConfiguracaoPiloto, ControladorOperacoesPiloto } from './apresentacao/controlador-configuracao-piloto';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { TenantConfiguracaoOrm } from '../tenancy/infraestrutura/tenant-configuracao.orm';
import { ServicoGamificacao } from './aplicacao/servico-gamificacao';
import { ControladorGamificacao } from './apresentacao/controlador-gamificacao';
import { BadgeOrm } from './infraestrutura/badge.orm';
import { CirculoPacientesOrm } from './infraestrutura/circulo-pacientes.orm';
import { DesafioOrm } from './infraestrutura/desafio.orm';
import { MembroCirculoOrm } from './infraestrutura/membro-circulo.orm';
import { ModeracaoPostOrm } from './infraestrutura/moderacao-post.orm';
import { PacienteBadgeOrm } from './infraestrutura/paciente-badge.orm';
import { ParticipacaoDesafioOrm } from './infraestrutura/participacao-desafio.orm';
import { PostComunidadeOrm } from './infraestrutura/post-comunidade.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CirculoPacientesOrm,
      MembroCirculoOrm,
      PostComunidadeOrm,
      ModeracaoPostOrm,
      DesafioOrm,
      ParticipacaoDesafioOrm,
      BadgeOrm,
      PacienteBadgeOrm,
      ConsentimentoConquistaOrm,
      ComentarioComunidadeOrm,
      CurtidaComunidadeOrm,
      DenunciaComunidadeOrm,
      RevisaoPublicacaoOrm,
      ComandoGamificacaoOrm,
      PacienteOrm,
      ProfissionalOrm,
      TenantConfiguracaoOrm,
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorConsolePiloto, ControladorPortalPiloto, ControladorGamificacao, ControladorConfiguracaoPiloto, ControladorOperacoesPiloto],
  providers: [ServicoExcecaoRetencaoPiloto, ...(deveExecutarProcessadores() ? [ProcessadorRetencaoPiloto] : []), ServicoRetencaoPiloto, ServicoModeracaoPiloto, CriptografiaDadosSensiveis, ConteudoPiloto, ContextoGamificacaoPiloto, ServicoConquistasPiloto, ServicoCirculosPiloto, ServicoPublicacoesPiloto, ServicoGamificacao, ServicoConfiguracaoPiloto, ServicoAuditoria],
  exports: [ServicoGamificacao]
})
export class ModuloGamificacao {}
