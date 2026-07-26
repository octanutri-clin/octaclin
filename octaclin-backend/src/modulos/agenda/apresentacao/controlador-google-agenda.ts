import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Controller, Get, Headers, HttpCode, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from '../aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from '../aplicacao/servico-google-calendar';
import { FILA_SINCRONIZACAO_GOOGLE } from '../aplicacao/servico-sincronizacao-google-calendar';

function urlCallback(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/callback`;
}

function urlWebhook(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/notificacoes`;
}

@Controller('agenda/google')
export class ControladorGoogleAgenda {
  constructor(
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly executorTenant: ExecutorTenant,
    private readonly fonteDados: DataSource,
    @InjectQueue(FILA_SINCRONIZACAO_GOOGLE) private readonly filaSincronizacao: Queue
  ) {}

  @Get('conectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async conectar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<{ url: string }> {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const url = this.servicoConexao.gerarUrlAutorizacao(usuario.tenantId, profissionalId, urlCallback());
    return { url };
  }

  @Get('callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string) {
    const { tenantId, profissionalId } = await this.servicoConexao.validarEDecodificarState(state);
    await this.servicoConexao.trocarCodigoPorConexao(tenantId, profissionalId, code, urlCallback());
    await this.criarCanalParaProfissional(tenantId, profissionalId);

    const urlWeb = process.env.OCTACLIN_WEB_URL?.trim() ?? '/';
    return { url: `${urlWeb.replace(/\/$/, '')}/agenda?google=conectado`, statusCode: 302 };
  }

  @Get('status')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async status(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const credenciais = await this.servicoConexao.obterConexaoAtiva(usuario.tenantId, profissionalId);
    return { conectado: Boolean(credenciais) };
  }

  @Post('desconectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async desconectar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    await this.servicoConexao.desconectar(usuario.tenantId, profissionalId);
    return { desconectado: true };
  }

  @Post('notificacoes')
  @HttpCode(200)
  async receberNotificacao(
    @Headers('x-goog-channel-id') canalWatchId?: string,
    @Headers('x-goog-channel-token') tokenRecebido?: string,
    @Headers('x-goog-message-number') numeroMensagem?: string
  ): Promise<void> {
    if (!canalWatchId) return;

    const canal = await this.fonteDados.getRepository(GoogleCanalWatchOrm).findOne({ where: { canalWatchId } });
    if (!canal || !canal.token || !tokenRecebido) return;

    const bufferRecebido = Buffer.from(tokenRecebido);
    const bufferEsperado = Buffer.from(canal.token);
    const tokenValido = bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);
    if (!tokenValido) return;

    await this.filaSincronizacao.add(
      'notificacao',
      { canalWatchId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: numeroMensagem ? `${canalWatchId}:${numeroMensagem}` : undefined,
        removeOnComplete: 500,
        removeOnFail: 500
      }
    );
  }

  private async criarCanalParaProfissional(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const canalId = randomUUID();
    const token = randomBytes(24).toString('hex');
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, canalId, urlWebhook(), token);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.canalWatchId = canalId;
      conexao.canalRecursoId = recursoId;
      conexao.canalExpiraEm = expiraEm;
      await repositorio.save(conexao);
    });

    await this.fonteDados.getRepository(GoogleCanalWatchOrm).save(
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({ canalWatchId: canalId, tenantId, profissionalId, expiraEm, token })
    );
  }

  private async resolverProfissionalIdObrigatorio(usuario: UsuarioAutenticado): Promise<string> {
    if (usuario.papel !== 'Professional') {
      throw new Error('Somente profissionais podem conectar a propria Google Agenda nesta fase.');
    }
    const profissionalId = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const { resolverProfissionalIdDoUsuario } = await import('../../../infraestrutura/seguranca/escopo-profissional');
      return resolverProfissionalIdDoUsuario(gerenciador, usuario.tenantId, usuario);
    });
    if (!profissionalId) throw new Error('Profissional nao encontrado para o usuario autenticado.');
    return profissionalId;
  }
}
