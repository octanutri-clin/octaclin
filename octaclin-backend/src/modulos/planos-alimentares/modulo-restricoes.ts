import { Module } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoConfirmacaoRestricao } from './aplicacao/servico-confirmacao-restricao';
import { ServicoLeituraRestricao } from './aplicacao/servico-leitura-restricao';
import { ServicoReconfirmacaoRestricao } from './aplicacao/servico-reconfirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from './aplicacao/servico-registro-pendencia-restricao';
import { ServicoSolicitacoesRestricao } from './aplicacao/servico-solicitacoes-restricao';
import { ControladorRestricoesClinicas } from './apresentacao/controlador-restricoes-clinicas';
import { ControladorRestricoesColaborador } from './apresentacao/controlador-restricoes-colaborador';
import { ServicoDelegacoesCarteira } from '../profissionais/aplicacao/servico-delegacoes-carteira';
import { ControladorDelegacoesCarteira } from '../profissionais/apresentacao/controlador-delegacoes-carteira';
import { ServicoPortalRestricoes } from './aplicacao/servico-portal-restricoes';
import { ControladorPortalRestricoes } from './apresentacao/controlador-portal-restricoes';
import { ServicoVinculosRepresentacao } from '../pacientes/aplicacao/servico-vinculos-representacao';
import { ControladorRepresentantesPaciente } from '../pacientes/apresentacao/controlador-representantes-paciente';

/** Rotas clínicas, do colaborador delegado, da delegação de carteira (P2d-2), dos representantes e do portal (P2d-3a) só respondem com a flag `restricoes.clinicas` ligada (padrão desligada); sem exports. */
@Module({
  imports: [ModuloTenancy, ModuloAuth],
  controllers: [ControladorRestricoesClinicas, ControladorRestricoesColaborador, ControladorDelegacoesCarteira,
    ControladorRepresentantesPaciente, ControladorPortalRestricoes],
  providers: [CriptografiaDadosSensiveis, ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao,
    ServicoReconfirmacaoRestricao, ServicoLeituraRestricao, ServicoSolicitacoesRestricao, ServicoDelegacoesCarteira,
    ServicoVinculosRepresentacao, ServicoPortalRestricoes]
})
export class ModuloRestricoes {}
