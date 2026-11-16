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

/** Rotas clínicas, do colaborador delegado e da delegação de carteira (P2d-2) só respondem com a flag `restricoes.clinicas` ligada (padrão desligada); sem exports. */
@Module({
  imports: [ModuloTenancy, ModuloAuth],
  controllers: [ControladorRestricoesClinicas, ControladorRestricoesColaborador, ControladorDelegacoesCarteira],
  providers: [CriptografiaDadosSensiveis, ServicoRegistroPendenciaRestricao, ServicoConfirmacaoRestricao,
    ServicoReconfirmacaoRestricao, ServicoLeituraRestricao, ServicoSolicitacoesRestricao, ServicoDelegacoesCarteira]
})
export class ModuloRestricoes {}
