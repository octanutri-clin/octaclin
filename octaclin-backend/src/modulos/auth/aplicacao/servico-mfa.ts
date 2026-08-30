import { createHash, createHmac, randomInt, randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsNull, LessThan, MoreThan } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { exigeMfaPorPapel } from '../dominio/politica-mfa';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import {
  ALGORITMO_JWT,
  obterAudienciaJwt,
  obterEmissorJwt,
  obterSegredoAcesso
} from '../infraestrutura/configuracao-jwt';
import { MfaCodigoRecuperacaoOrm } from '../infraestrutura/mfa-codigo-recuperacao.orm';
import { MfaDesafioOrm, type TipoDesafioMfa } from '../infraestrutura/mfa-desafio.orm';
import { MfaFatorUsuarioOrm } from '../infraestrutura/mfa-fator-usuario.orm';
import { ServicoSessoes } from './servico-sessoes';
import { ServicoTotp } from './servico-totp';
import { POLITICA_MFA, ServicoProtecaoAbuso } from './servico-protecao-abuso';

const DURACAO_DESAFIO_MS = 5 * 60 * 1000;
const DURACAO_CONFIGURACAO_MS = 10 * 60 * 1000;
const QUANTIDADE_CODIGOS_RECUPERACAO = 10;
const ROTULO_SEGREDO_DESAFIO = 'octaclin-desafio-mfa-v1';

export interface DesafioLoginMfa {
  mfaObrigatorio: true;
  modo: 'configurar' | 'verificar';
  desafioMfa: string;
}

interface ClaimsDesafioMfa {
  tipo: 'desafio_mfa';
  sub: string;
  tenantId: string;
  jti: string;
  finalidade: TipoDesafioMfa;
}

@Injectable()
export class ServicoMfa {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly jwt: JwtService,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly totp: ServicoTotp,
    private readonly auditoria: ServicoAuditoria,
    private readonly sessoes: ServicoSessoes,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  async iniciarLogin(usuario: UsuarioOrm): Promise<DesafioLoginMfa | null> {
    const fator = await this.executorTenant.executar(usuario.tenantId, (gerenciador) =>
      gerenciador.getRepository(MfaFatorUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.id }
      })
    );
    const habilitado = Boolean(fator?.habilitadoEm && fator.segredoCriptografado);
    if (!habilitado && !exigeMfaPorPapel(usuario.role)) return null;

    const tipo: TipoDesafioMfa = habilitado ? 'login_verificar' : 'login_configurar';
    if (!habilitado) await this.prepararSegredoPendente(usuario.tenantId, usuario.id);
    return this.criarDesafio(usuario.tenantId, usuario.id, tipo);
  }

  async obterConfiguracao(desafioAssinado: string) {
    const claims = await this.validarDesafio(desafioAssinado, 'login_configurar');
    return this.executorTenant.executar(claims.tenantId, async (gerenciador) => {
      const fator = await gerenciador.getRepository(MfaFatorUsuarioOrm).findOne({
        where: {
          tenantId: claims.tenantId,
          usuarioId: claims.sub,
          pendenteExpiraEm: MoreThan(new Date())
        }
      });
      if (!fator?.segredoPendenteCriptografado) throw this.erroMfa();
      const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: claims.sub, tenantId: claims.tenantId, ativo: true }
      });
      if (!usuario) throw this.erroMfa();
      const segredo = this.criptografia.descriptografar(fator.segredoPendenteCriptografado);
      return {
        segredo,
        uri: this.totp.criarUri(segredo, this.criptografia.descriptografar(usuario.emailCriptografado)),
        expiraEm: fator.pendenteExpiraEm!.toISOString()
      };
    });
  }

  async concluirLogin(desafioAssinado: string, codigo: string): Promise<{
    usuario: UsuarioOrm;
    codigosRecuperacao: string[];
    mfaVerificadoEm: Date;
  }> {
    const chaveProtecao = `mfa:desafio:${createHash('sha256').update(desafioAssinado).digest('hex')}`;
    await this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_MFA);
    try {
      const resultado = await this.concluirLoginValidado(desafioAssinado, codigo);
      await this.protecaoAbuso.registrarSucesso(chaveProtecao);
      return resultado;
    } catch (erro) {
      if (erro instanceof UnauthorizedException) {
        await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_MFA);
      }
      throw erro;
    }
  }

  private async concluirLoginValidado(desafioAssinado: string, codigo: string): Promise<{
    usuario: UsuarioOrm;
    codigosRecuperacao: string[];
    mfaVerificadoEm: Date;
  }> {
    const claims = await this.validarDesafio(desafioAssinado);
    const agora = new Date();

    const resultado = await this.executorTenant.executar(claims.tenantId, async (gerenciador) => {
      const desafios = gerenciador.getRepository(MfaDesafioOrm);
      const desafio = await desafios.findOne({
        where: {
          id: claims.jti,
          tenantId: claims.tenantId,
          usuarioId: claims.sub,
          tipo: claims.finalidade,
          consumidoEm: IsNull(),
          expiraEm: MoreThan(agora)
        }
      });
      if (!desafio) throw this.erroMfa();

      const fatores = gerenciador.getRepository(MfaFatorUsuarioOrm);
      const fator = await fatores.findOne({ where: { tenantId: claims.tenantId, usuarioId: claims.sub } });
      if (!fator) throw this.erroMfa();

      let codigosRecuperacao: string[] = [];
      let metodoValidacao: 'totp' | 'codigo_recuperacao' = 'totp';
      if (claims.finalidade === 'login_configurar') {
        if (!fator.segredoPendenteCriptografado || !fator.pendenteExpiraEm || fator.pendenteExpiraEm <= agora) {
          throw this.erroMfa();
        }
        const segredo = this.criptografia.descriptografar(fator.segredoPendenteCriptografado);
        const validacao = this.totp.validar(segredo, codigo);
        if (!validacao.valido) throw this.erroMfa();

        const ativacao = await fatores.update(
          {
            tenantId: claims.tenantId,
            usuarioId: claims.sub,
            pendenteExpiraEm: MoreThan(agora)
          },
          {
            segredoCriptografado: fator.segredoPendenteCriptografado,
            segredoPendenteCriptografado: null,
            pendenteExpiraEm: null,
            habilitadoEm: agora,
            ultimoContadorTotp: String(validacao.contador)
          }
        );
        if ((ativacao.affected ?? 0) !== 1) throw this.erroMfa();
        codigosRecuperacao = await this.substituirCodigosRecuperacao(gerenciador, claims.tenantId, claims.sub);
      } else {
        metodoValidacao = await this.validarFatorAtivo(gerenciador, fator, codigo, agora);
      }

      const consumo = await desafios.update(
        {
          id: claims.jti,
          tenantId: claims.tenantId,
          usuarioId: claims.sub,
          consumidoEm: IsNull(),
          expiraEm: MoreThan(agora)
        },
        { consumidoEm: agora }
      );
      if ((consumo.affected ?? 0) !== 1) throw this.erroMfa();

      const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: claims.sub, tenantId: claims.tenantId, ativo: true }
      });
      if (!usuario) throw this.erroMfa();
      return { usuario, codigosRecuperacao, mfaVerificadoEm: agora, metodoValidacao };
    });

    await this.auditoria.registrar({
      tenantId: claims.tenantId,
      usuarioId: claims.sub,
      acao: claims.finalidade === 'login_configurar' ? 'auth.mfa.habilitado' : 'auth.mfa.validado',
      recursoTipo: 'mfa'
    });
    if (resultado.metodoValidacao === 'codigo_recuperacao') {
      await this.auditoria.registrar({
        tenantId: claims.tenantId,
        usuarioId: claims.sub,
        acao: 'auth.mfa.codigo_recuperacao_usado',
        recursoTipo: 'mfa'
      });
    }
    const { metodoValidacao: _metodoValidacao, ...resposta } = resultado;
    return resposta;
  }

  async obterStatus(usuario: UsuarioAutenticado) {
    const [fator, codigosDisponiveis] = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const atual = await gerenciador.getRepository(MfaFatorUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      });
      const quantidade = await gerenciador.getRepository(MfaCodigoRecuperacaoOrm).count({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, usadoEm: IsNull() }
      });
      return [atual, quantidade] as const;
    });
    return {
      obrigatorio: exigeMfaPorPapel(usuario.papel),
      habilitado: Boolean(fator?.habilitadoEm && fator.segredoCriptografado),
      habilitadoEm: fator?.habilitadoEm?.toISOString(),
      codigosRecuperacaoDisponiveis: codigosDisponiveis
    };
  }

  async iniciarConfiguracao(usuario: UsuarioAutenticado) {
    await this.prepararSegredoPendente(usuario.tenantId, usuario.usuarioId);
    const [fator, conta] = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => Promise.all([
      gerenciador.getRepository(MfaFatorUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      }),
      gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: usuario.usuarioId, tenantId: usuario.tenantId, ativo: true }
      })
    ]));
    if (!fator?.segredoPendenteCriptografado || !fator.pendenteExpiraEm || !conta) throw this.erroMfa();
    const segredo = this.criptografia.descriptografar(fator.segredoPendenteCriptografado);
    const rotuloConta = this.criptografia.descriptografar(conta.emailCriptografado);
    return { segredo, uri: this.totp.criarUri(segredo, rotuloConta), expiraEm: fator.pendenteExpiraEm.toISOString() };
  }

  async confirmarConfiguracao(usuario: UsuarioAutenticado, codigo: string) {
    const chaveProtecao = `mfa:configuracao:${usuario.tenantId}:${usuario.usuarioId}`;
    await this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_MFA);
    try {
      const resultado = await this.confirmarConfiguracaoValidada(usuario, codigo);
      await this.protecaoAbuso.registrarSucesso(chaveProtecao);
      return resultado;
    } catch (erro) {
      if (erro instanceof UnauthorizedException) {
        await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_MFA);
      }
      throw erro;
    }
  }

  private async confirmarConfiguracaoValidada(usuario: UsuarioAutenticado, codigo: string) {
    const agora = new Date();
    const codigosRecuperacao = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const fatores = gerenciador.getRepository(MfaFatorUsuarioOrm);
      const fator = await fatores.findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, pendenteExpiraEm: MoreThan(agora) }
      });
      if (!fator?.segredoPendenteCriptografado) throw this.erroMfa();
      const segredo = this.criptografia.descriptografar(fator.segredoPendenteCriptografado);
      const validacao = this.totp.validar(segredo, codigo);
      if (!validacao.valido) throw this.erroMfa();
      const atualizacao = await fatores.update(
        { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, pendenteExpiraEm: MoreThan(agora) },
        {
          segredoCriptografado: fator.segredoPendenteCriptografado,
          segredoPendenteCriptografado: null,
          pendenteExpiraEm: null,
          habilitadoEm: agora,
          ultimoContadorTotp: String(validacao.contador)
        }
      );
      if ((atualizacao.affected ?? 0) !== 1) throw this.erroMfa();
      return this.substituirCodigosRecuperacao(gerenciador, usuario.tenantId, usuario.usuarioId);
    });
    await this.sessoes.revogarTodas(usuario.tenantId, usuario.usuarioId, 'encerrada_outras');
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'auth.mfa.reconfigurado', recursoTipo: 'mfa' });
    return { codigosRecuperacao };
  }

  async regenerarCodigos(usuario: UsuarioAutenticado) {
    const codigosRecuperacao = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const fator = await gerenciador.getRepository(MfaFatorUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      });
      if (!fator?.habilitadoEm) throw this.erroMfa();
      return this.substituirCodigosRecuperacao(gerenciador, usuario.tenantId, usuario.usuarioId);
    });
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'auth.mfa.codigos_regenerados', recursoTipo: 'mfa' });
    return { codigosRecuperacao };
  }

  async removerFator(usuario: UsuarioAutenticado) {
    await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      await gerenciador.getRepository(MfaCodigoRecuperacaoOrm).delete({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId });
      await gerenciador.getRepository(MfaFatorUsuarioOrm).delete({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId });
    });
    await this.sessoes.revogarTodas(usuario.tenantId, usuario.usuarioId, 'encerrada_pelo_usuario');
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'auth.mfa.removido', recursoTipo: 'mfa' });
  }

  private async prepararSegredoPendente(tenantId: string, usuarioId: string): Promise<void> {
    const segredo = this.totp.gerarSegredo();
    const segredoPendenteCriptografado = this.criptografia.criptografar(segredo);
    const pendenteExpiraEm = new Date(Date.now() + DURACAO_CONFIGURACAO_MS);
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(MfaFatorUsuarioOrm);
      const existente = await repositorio.findOne({ where: { tenantId, usuarioId } });
      if (existente) {
        await repositorio.update({ tenantId, usuarioId }, { segredoPendenteCriptografado, pendenteExpiraEm });
      } else {
        await repositorio.save(repositorio.create({
          tenantId,
          usuarioId,
          segredoCriptografado: null,
          segredoPendenteCriptografado,
          pendenteExpiraEm,
          habilitadoEm: null,
          ultimoContadorTotp: null
        }));
      }
    });
  }

  private async criarDesafio(tenantId: string, usuarioId: string, tipo: TipoDesafioMfa): Promise<DesafioLoginMfa> {
    const id = randomUUID();
    const expiraEm = new Date(Date.now() + DURACAO_DESAFIO_MS);
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(MfaDesafioOrm);
      await repositorio.save(repositorio.create({ id, tenantId, usuarioId, tipo, expiraEm, consumidoEm: null }));
    });
    const desafioMfa = await this.jwt.signAsync(
      { tipo: 'desafio_mfa', sub: usuarioId, tenantId, finalidade: tipo },
      {
        secret: this.segredoDesafio(),
        algorithm: ALGORITMO_JWT,
        issuer: obterEmissorJwt(),
        audience: `${obterAudienciaJwt()}:mfa`,
        jwtid: id,
        expiresIn: '5m'
      }
    );
    return { mfaObrigatorio: true, modo: tipo === 'login_configurar' ? 'configurar' : 'verificar', desafioMfa };
  }

  private async validarDesafio(desafio: string, finalidade?: TipoDesafioMfa): Promise<ClaimsDesafioMfa> {
    try {
      const payload = await this.jwt.verifyAsync(desafio, {
        secret: this.segredoDesafio(),
        algorithms: [ALGORITMO_JWT],
        issuer: obterEmissorJwt(),
        audience: `${obterAudienciaJwt()}:mfa`,
        ignoreExpiration: false
      });
      if (
        payload?.tipo !== 'desafio_mfa' ||
        typeof payload?.sub !== 'string' ||
        typeof payload?.tenantId !== 'string' ||
        typeof payload?.jti !== 'string' ||
        !['login_verificar', 'login_configurar'].includes(payload?.finalidade) ||
        (finalidade && payload.finalidade !== finalidade)
      ) throw this.erroMfa();
      return payload as ClaimsDesafioMfa;
    } catch {
      throw this.erroMfa();
    }
  }

  private async validarFatorAtivo(
    gerenciador: import('typeorm').EntityManager,
    fator: MfaFatorUsuarioOrm,
    codigo: string,
    agora: Date
  ): Promise<'totp' | 'codigo_recuperacao'> {
    if (!fator.segredoCriptografado || !fator.habilitadoEm) throw this.erroMfa();
    if (!/^\d{6}$/.test(codigo)) {
      const consumo = await gerenciador.getRepository(MfaCodigoRecuperacaoOrm).update(
        { tenantId: fator.tenantId, usuarioId: fator.usuarioId, codigoHash: this.hashCodigo(codigo), usadoEm: IsNull() },
        { usadoEm: agora }
      );
      if ((consumo.affected ?? 0) !== 1) throw this.erroMfa();
      return 'codigo_recuperacao';
    }

    const segredo = this.criptografia.descriptografar(fator.segredoCriptografado);
    const validacao = this.totp.validar(segredo, codigo);
    if (!validacao.valido) throw this.erroMfa();
    const atualizacao = await gerenciador.getRepository(MfaFatorUsuarioOrm).update(
      {
        tenantId: fator.tenantId,
        usuarioId: fator.usuarioId,
        ultimoContadorTotp: LessThan(String(validacao.contador))
      },
      { ultimoContadorTotp: String(validacao.contador) }
    );
    if ((atualizacao.affected ?? 0) !== 1) throw this.erroMfa();
    return 'totp';
  }

  private async substituirCodigosRecuperacao(
    gerenciador: import('typeorm').EntityManager,
    tenantId: string,
    usuarioId: string
  ): Promise<string[]> {
    const repositorio = gerenciador.getRepository(MfaCodigoRecuperacaoOrm);
    await repositorio.delete({ tenantId, usuarioId });
    const codigos = Array.from({ length: QUANTIDADE_CODIGOS_RECUPERACAO }, () => this.gerarCodigoRecuperacao());
    await repositorio.save(codigos.map((codigo) => repositorio.create({
      tenantId,
      usuarioId,
      codigoHash: this.hashCodigo(codigo),
      usadoEm: null
    })));
    return codigos;
  }

  private gerarCodigoRecuperacao(): string {
    const alfabeto = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const bruto = Array.from(
      { length: 12 },
      () => alfabeto[randomInt(0, alfabeto.length)]
    ).join('');
    return `${bruto.slice(0, 4)}-${bruto.slice(4, 8)}-${bruto.slice(8, 12)}`;
  }

  private hashCodigo(codigo: string): string {
    return createHash('sha256').update(codigo.trim().toUpperCase()).digest('hex');
  }

  private segredoDesafio(): string {
    return createHmac('sha256', obterSegredoAcesso()).update(ROTULO_SEGREDO_DESAFIO).digest('hex');
  }

  private erroMfa() {
    return new UnauthorizedException('Código de verificação inválido ou expirado.');
  }
}
