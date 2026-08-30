import { createHmac, randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { exigeMfaPorPapel } from '../dominio/politica-mfa';
import { POLITICA_REAUTENTICACAO, ServicoProtecaoAbuso } from './servico-protecao-abuso';
import {
  ALGORITMO_JWT,
  obterAudienciaJwt,
  obterEmissorJwt,
  obterSegredoAcesso
} from '../infraestrutura/configuracao-jwt';

const FINALIDADE_REAUTENTICACAO = 'octaclin-reauth-v1';
const DURACAO_PROVA = '5m';

interface VinculoProva {
  tenantId: string;
  usuarioId: string;
  sessaoId: string;
}

@Injectable()
export class ServicoReautenticacao {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly jwt: JwtService,
    private readonly senhas: ServicoSenhas,
    private readonly protecaoAbuso: ServicoProtecaoAbuso,
    private readonly auditoria: ServicoAuditoria
  ) {}

  async reautenticar(usuario: UsuarioAutenticado, senha: string): Promise<{ prova: string; expiraEmSegundos: number }> {
    if (!usuario.sessaoId) throw new UnauthorizedException('Sessão não identificada.');
    if (exigeMfaPorPapel(usuario.papel) && usuario.mfaVerificado !== true) {
      throw new UnauthorizedException('Autenticação multifator obrigatória.');
    }
    const chaveProtecao = `reauth:${usuario.tenantId}:${usuario.usuarioId}:${usuario.sessaoId}`;
    await this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_REAUTENTICACAO);

    const conta = await this.executorTenant.executar(usuario.tenantId, (gerenciador) =>
      gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: usuario.usuarioId, tenantId: usuario.tenantId, ativo: true }
      })
    );
    if (!conta || !this.senhas.verificar(senha, conta.senhaHash)) {
      await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_REAUTENTICACAO);
      await this.auditoria.registrar({
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'auth.reautenticacao.falhou',
        recursoTipo: 'sessao'
      });
      throw new UnauthorizedException('Não foi possível confirmar suas credenciais.');
    }

    await this.protecaoAbuso.registrarSucesso(chaveProtecao);

    const prova = await this.jwt.signAsync(
      {
        tipo: 'reautenticacao',
        sub: usuario.usuarioId,
        tenantId: usuario.tenantId,
        sid: usuario.sessaoId
      },
      {
        secret: this.segredoDerivado(),
        algorithm: ALGORITMO_JWT,
        issuer: obterEmissorJwt(),
        audience: `${obterAudienciaJwt()}:reauth`,
        jwtid: randomUUID(),
        expiresIn: DURACAO_PROVA
      }
    );
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'auth.reautenticacao.concluida',
      recursoTipo: 'sessao'
    });
    return { prova, expiraEmSegundos: 300 };
  }

  async validarProva(prova: string, esperado: VinculoProva): Promise<void> {
    const payload = await this.jwt.verifyAsync(prova, {
      secret: this.segredoDerivado(),
      algorithms: [ALGORITMO_JWT],
      issuer: obterEmissorJwt(),
      audience: `${obterAudienciaJwt()}:reauth`,
      ignoreExpiration: false
    });

    if (
      payload?.tipo !== 'reautenticacao' ||
      payload?.sub !== esperado.usuarioId ||
      payload?.tenantId !== esperado.tenantId ||
      payload?.sid !== esperado.sessaoId
    ) {
      throw new UnauthorizedException('Prova de reautenticação inválida.');
    }
  }

  private segredoDerivado(): string {
    return createHmac('sha256', obterSegredoAcesso()).update(FINALIDADE_REAUTENTICACAO).digest('hex');
  }
}
