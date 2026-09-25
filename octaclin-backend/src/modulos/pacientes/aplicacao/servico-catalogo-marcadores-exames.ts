import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import type { PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CatalogoMarcadorExameOrm } from '../infraestrutura/catalogo-marcador-exame.orm';
import { CriarCatalogoMarcadorExameDto, ListarCatalogoMarcadoresExamesDto } from './dtos';

type Definicao = { nome: string; unidade?: string; limiteInferior?: string; limiteSuperior?: string };

function numeroLimite(valor: string | undefined): number | undefined {
  if (valor === undefined || !/^-?\d+(?:[.,]\d+)?$/.test(valor)) return undefined;
  const numero = Number(valor.replace(',', '.'));
  return Number.isFinite(numero) ? numero : undefined;
}

@Injectable()
export class ServicoCatalogoMarcadoresExames {
  constructor(private readonly executorTenant: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis) {}

  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarCatalogoMarcadorExameDto) {
    this.garantirAcesso(tenantId, usuario, 'pacientes.gerenciar');
    const nome = dados.nome.trim();
    if (nome.length < 2) throw new BadRequestException('Nome do marcador invalido.');
    const unidade = dados.unidade?.trim() || undefined;
    const limiteInferior = dados.limiteInferior?.replace(',', '.');
    const limiteSuperior = dados.limiteSuperior?.replace(',', '.');
    const inferior = numeroLimite(limiteInferior);
    const superior = numeroLimite(limiteSuperior);
    if ((limiteInferior !== undefined && inferior === undefined)
      || (limiteSuperior !== undefined && superior === undefined)
      || (inferior !== undefined && superior !== undefined && inferior > superior)) {
      throw new BadRequestException('Faixa de referencia numerica invalida.');
    }
    if ((limiteInferior !== undefined || limiteSuperior !== undefined) && !unidade) {
      throw new BadRequestException('Informe a unidade para a faixa de referencia.');
    }
    const definicao: Definicao = { nome, unidade, limiteInferior, limiteSuperior };
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(CatalogoMarcadorExameOrm);
      const item = await repositorio.save(repositorio.create({
        tenantId, definicaoCriptografada: this.criptografia.criptografar(JSON.stringify(definicao)),
        criadoPorUsuarioId: usuario.usuarioId
      }));
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'pacientes.catalogo_marcadores_exames.criar',
        recursoTipo: 'catalogo_marcador_exame', recursoId: item.id
      });
      return { id: item.id, ...definicao };
    });
  }

  async listar(tenantId: string, usuario: UsuarioAutenticado, consulta: ListarCatalogoMarcadoresExamesDto = {}) {
    this.garantirAcesso(tenantId, usuario, 'pacientes.ler');
    const pagina = consulta.pagina ?? 1;
    const limite = consulta.limite ?? 25;
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [itens, total] = await gerenciador.getRepository(CatalogoMarcadorExameOrm).findAndCount({
        where: { tenantId, arquivadoEm: IsNull() },
        order: { atualizadoEm: 'DESC', id: 'DESC' }, skip: (pagina - 1) * limite, take: limite
      });
      return {
        itens: itens.map((item) => ({
          id: item.id, ...JSON.parse(this.criptografia.descriptografar(item.definicaoCriptografada)) as Definicao
        })), total, pagina, limite
      };
    });
  }

  async arquivar(tenantId: string, itemId: string, usuario: UsuarioAutenticado) {
    this.garantirAcesso(tenantId, usuario, 'pacientes.gerenciar');
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const item = await this.obterNoEscopo(gerenciador, tenantId, itemId);
      item.arquivadoEm = new Date();
      await gerenciador.getRepository(CatalogoMarcadorExameOrm).save(item);
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId, usuarioId: usuario.usuarioId, acao: 'pacientes.catalogo_marcadores_exames.arquivar',
        recursoTipo: 'catalogo_marcador_exame', recursoId: item.id
      });
      return { id: item.id, arquivadoEm: item.arquivadoEm };
    });
  }

  private async obterNoEscopo(gerenciador: EntityManager, tenantId: string, itemId: string) {
    const item = await gerenciador.getRepository(CatalogoMarcadorExameOrm).findOne({
      where: { id: itemId, tenantId, arquivadoEm: IsNull() }
    });
    if (!item) throw new NotFoundException('Marcador do catalogo nao encontrado.');
    return item;
  }

  private garantirAcesso(tenantId: string, usuario: UsuarioAutenticado, permissao: PermissaoOctaClin) {
    const papeisPermitidos = permissao === 'pacientes.ler'
      ? ['SuperAdmin', 'Professional', 'Collaborator']
      : ['SuperAdmin', 'Professional'];
    if (tenantId !== usuario.tenantId || !papeisPermitidos.includes(usuario.papel)
      || !usuario.permissoes.includes(permissao)) {
      throw new ForbiddenException('Acesso ao catalogo de marcadores nao permitido.');
    }
  }
}
