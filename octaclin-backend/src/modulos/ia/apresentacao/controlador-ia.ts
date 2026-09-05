import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto, RevisarSugestaoIaDto } from '../aplicacao/dtos';
import { ServicoIa } from '../aplicacao/servico-ia';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';

@Controller('ia')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@Papeis('SuperAdmin', 'Professional')
@Permissoes('ia.executar')
@FeatureFlag('ia.clinica')
export class ControladorIa {
  constructor(
    private readonly servicoIa: ServicoIa,
    private readonly servicoAuditoria: ServicoAuditoria,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  @Get('sentimento')
  listarAnalisesSentimento(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoIa.listarAnalisesSentimento(usuario.tenantId, usuario);
  }

  @Post('sentimento')
  async analisarSentimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AnalisarSentimentoDto
  ) {
    await this.consumirLimite(usuario, 'sentimento', 30);
    const iniciadoEm = Date.now();
    const analise = await this.servicoIa.analisarSentimento(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'ia.sentimento.analisar', 'analise_sentimento', analise.id, {
      pacienteId: dados.pacienteId,
      respostaCheckinId: dados.respostaCheckinId,
      transcricaoMidiaId: dados.transcricaoMidiaId,
      // `alertaDisparado` fica de fora: e derivado de `frustracaoScore >= 70`,
      // isto e, a classificacao de risco de um paciente identificado -- o
      // resultado da inferencia, e nao o rastro de que ela aconteceu. Mesma
      // decisao que tirou `humor` e `adesaoPlano` da trilha na fase 1.
      origemContexto: dados.contexto?.origem,
      modelo: analise.modelo,
      // `dados.texto` e o relato do paciente. So o tamanho entra -- ver a nota
      // de doutrina em `registrarAuditoria`.
      tamanhoTextoCaracteres: dados.texto.length,
      duracaoMs: Date.now() - iniciadoEm
    });
    return analise;
  }

  @Get('reconhecimento-alimentar')
  listarReconhecimentosAlimentares(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoIa.listarReconhecimentosAlimentares(usuario.tenantId, usuario);
  }

  @Post('reconhecimento-alimentar')
  async reconhecerAlimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: ReconhecerAlimentoDto
  ) {
    await this.consumirLimite(usuario, 'reconhecimento', 20);
    const iniciadoEm = Date.now();
    const reconhecimento = await this.servicoIa.reconhecerAlimento(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'ia.reconhecimento_alimentar.criar', 'reconhecimento_alimentar', reconhecimento.id, {
      pacienteId: dados.pacienteId,
      arquivoMidiaId: dados.arquivoMidiaId,
      totalAlimentos: reconhecimento.alimentosDetectados.length,
      provedor: reconhecimento.provedor,
      duracaoMs: Date.now() - iniciadoEm
      // `alimentosDetectados` fica de fora: e a inferencia sobre a refeicao de
      // um paciente identificado, isto e, o resultado clinico, e nao o rastro
      // de quem o produziu.
    });
    return reconhecimento;
  }

  @Patch('sentimento/:id/revisao')
  async revisarAnaliseSentimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: RevisarSugestaoIaDto
  ) {
    const analise = await this.servicoIa.revisarAnaliseSentimento(usuario.tenantId, id, dados, usuario);
    // Nem `observacao` nem `conteudoEditado` entram: o primeiro e texto livre
    // do profissional sobre o caso, o segundo e a correcao clinica em si.
    await this.registrarAuditoria(usuario, requisicao, 'ia.sentimento.revisar', 'analise_sentimento', id, {
      decisao: dados.decisao,
      houveTextoLivre: Boolean(dados.observacao?.trim()),
      conteudoEditadoInformado: dados.conteudoEditado !== undefined
    });
    return analise;
  }

  @Patch('reconhecimento-alimentar/:id/revisao')
  async revisarReconhecimentoAlimentar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: RevisarSugestaoIaDto
  ) {
    const reconhecimento = await this.servicoIa.revisarReconhecimentoAlimentar(
      usuario.tenantId,
      id,
      dados,
      usuario
    );
    await this.registrarAuditoria(usuario, requisicao, 'ia.reconhecimento_alimentar.revisar', 'reconhecimento_alimentar', id, {
      decisao: dados.decisao,
      houveTextoLivre: Boolean(dados.observacao?.trim()),
      conteudoEditadoInformado: dados.conteudoEditado !== undefined
    });
    return reconhecimento;
  }

  /**
   * Trilha do modulo de IA -- so metadado operacional, nunca o conteudo.
   *
   * Este e o unico modulo em que o dado clinico sai do sistema: o texto do
   * relato e a imagem da refeicao vao para um provedor externo. Registrar *que*
   * isso aconteceu e obrigatorio; registrar *o que* foi enviado ou o que voltou
   * anularia a separacao de papeis que a trilha existe para sustentar. Quem le
   * `user_action_logs` -- operacao, suporte, auditoria externa -- tem direito de
   * saber que houve inferencia sobre o paciente X, e nao tem direito de ler o
   * relato dele. Gravar o prompt dentro do log do acesso ao dado clinico entrega
   * o prontuario a quem so podia ver o rastro, e entrega para sempre: a trilha e
   * imutavel e sobrevive ao expurgo do dado de origem.
   *
   * Por isso o que entra e: tipo de operacao, identificador opaco, modelo ou
   * provedor, tamanho e duracao. Tamanho e duracao nao descrevem o paciente, e
   * sao justamente o que denuncia uso anomalo -- rajada de textos longos por um
   * unico usuario e o formato de quem esta drenando prontuario pela IA.
   *
   * As leituras (`GET sentimento`, `GET reconhecimento-alimentar`) seguem sem
   * registro pela mesma decisao de escopo do console de operacoes: elas listam
   * o que ja foi derivado, nao enviam nada ao provedor, e auditar cada abertura
   * de tela afogaria o evento que importa.
   */
  private registrarAuditoria(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    recursoTipo: string,
    recursoId?: string,
    metadados?: Record<string, unknown>
  ) {
    return this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo,
      recursoId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados
    });
  }

  private consumirLimite(usuario: UsuarioAutenticado, operacao: string, maxTentativas: number) {
    const janelaMs = 15 * 60 * 1000;
    const limiteTenant = operacao === 'reconhecimento' ? 60 : 120;
    return Promise.all([
      this.protecaoAbuso.consumirTentativa(`ia:${operacao}:tenant:${usuario.tenantId}`, {
        maxTentativas: limiteTenant,
        janelaMs,
        bloqueioMs: janelaMs,
        mensagemBloqueio: 'O limite temporario de IA da clinica foi atingido. Tente novamente em alguns minutos.'
      }),
      this.protecaoAbuso.consumirTentativa(`ia:${operacao}:${usuario.tenantId}:${usuario.usuarioId}`, {
        maxTentativas,
        janelaMs,
        bloqueioMs: janelaMs,
        mensagemBloqueio: 'Muitas solicitacoes de IA em pouco tempo. Tente novamente em alguns minutos.'
      })
    ]).then(() => undefined);
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
