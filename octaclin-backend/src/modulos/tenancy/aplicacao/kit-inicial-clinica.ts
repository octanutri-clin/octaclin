import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MaterialEducativoOrm } from '../../materiais/infraestrutura/material-educativo.orm';
import { TenantConfiguracaoOrm } from '../infraestrutura/tenant-configuracao.orm';
import {
  CHAVE_KIT_INICIAL_CLINICA,
  CHAVES_KIT_INICIAL_CLINICA,
  ChaveKitInicialClinica,
  interpretarMarcadorKitInicial,
  VERSAO_KIT_INICIAL_CLINICA
} from '../kit-inicial-clinica';

/** Conteúdo de uso do produto. Não contém prescrição ou dado de paciente. */
export const MATERIAIS_KIT_INICIAL = [
  {
    chave: 'material:plano-no-portal',
    titulo: 'Como acompanhar seu plano no portal',
    resumo: 'Encontre a versão publicada do plano e as orientações da equipe.',
    conteudo: 'Quando a equipe publicar um plano alimentar, ele aparecerá no portal. Leia as orientações registradas pelo profissional e use a conversa segura do portal para enviar dúvidas sobre o acompanhamento.'
  },
  {
    chave: 'material:registro-habitos',
    titulo: 'Como registrar hábitos',
    resumo: 'Registre seu acompanhamento para a equipe revisar.',
    conteudo: 'O Registro de hábitos permite informar como foi o acompanhamento do plano. A equipe poderá ler o registro; ele não substitui uma consulta ou resposta profissional.'
  },
  {
    chave: 'material:duvidas-consulta',
    titulo: 'Prepare suas dúvidas para a consulta',
    resumo: 'Organize perguntas para conversar com a equipe.',
    conteudo: 'Antes da consulta, anote suas dúvidas sobre o plano e os registros recentes. Compartilhe essas perguntas com a equipe pelo portal ou durante o atendimento.'
  }
] as const;

export type OrigemInstalacaoKitInicial = 'opt_in_cliente' | 'opt_in_superadmin' | 'provisionamento_assistido';

export interface ResultadoInstalacaoKitInicial {
  reutilizado: boolean;
  versaoMarcador: number;
  materiaisCriados: number;
  estruturasHabilitadas: ChaveKitInicialClinica[];
  itensAdicionados: ChaveKitInicialClinica[];
}

export async function instalarKitInicialClinica(
  gerenciador: EntityManager,
  tenantId: string,
  usuarioExecutorId: string,
  itensSolicitados: readonly ChaveKitInicialClinica[] = CHAVES_KIT_INICIAL_CLINICA,
  origem: OrigemInstalacaoKitInicial = 'provisionamento_assistido'
): Promise<ResultadoInstalacaoKitInicial> {
  if (!Array.isArray(itensSolicitados) || itensSolicitados.length < 1 || itensSolicitados.length > CHAVES_KIT_INICIAL_CLINICA.length ||
    itensSolicitados.some((item) => !CHAVES_KIT_INICIAL_CLINICA.includes(item)) ||
    new Set(itensSolicitados).size !== itensSolicitados.length) {
    throw new BadRequestException('Seleção do kit inicial inválida.');
  }
  if (!['opt_in_cliente', 'opt_in_superadmin', 'provisionamento_assistido'].includes(origem)) {
    throw new BadRequestException('Origem da instalação do kit inicial inválida.');
  }

  await gerenciador.query(
    'select pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`kit-inicial-clinica:${tenantId}`]
  );

  const configuracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
  const marcador = await configuracoes.findOne({ where: { tenantId, chave: CHAVE_KIT_INICIAL_CLINICA } });
  const interpretacao = interpretarMarcadorKitInicial(marcador?.valor);
  if (interpretacao.estado === 'incompativel' || interpretacao.estado === 'inconsistente') {
    throw new ConflictException('O marcador do kit inicial precisa de revisão antes de instalar.');
  }

  const instalados = new Set(interpretacao.itensInstalados);
  const itensAdicionados = CHAVES_KIT_INICIAL_CLINICA.filter((chave) => itensSolicitados.includes(chave) && !instalados.has(chave));
  if (itensAdicionados.length === 0) {
    return {
      reutilizado: true,
      versaoMarcador: interpretacao.versao ?? VERSAO_KIT_INICIAL_CLINICA,
      materiaisCriados: 0,
      estruturasHabilitadas: [],
      itensAdicionados: []
    };
  }

  const materiaisNovos = MATERIAIS_KIT_INICIAL.filter((material) => itensAdicionados.includes(material.chave));
  if (materiaisNovos.length > 0) {
    const repositorioMateriais = gerenciador.getRepository(MaterialEducativoOrm);
    await repositorioMateriais.save(materiaisNovos.map((item) => repositorioMateriais.create({
      tenantId,
      criadoPorUsuarioId: usuarioExecutorId,
      titulo: item.titulo,
      tipo: 'orientacao',
      categoria: 'Uso do portal',
      resumo: item.resumo,
      conteudo: item.conteudo,
      ativo: true
    })));
  }

  const agora = new Date().toISOString();
  const itensAcumulados = CHAVES_KIT_INICIAL_CLINICA.filter((chave) => instalados.has(chave) || itensSolicitados.includes(chave));
  const origemMarcador = marcador?.valor?.origem ?? origem;
  const novoValor = {
    versao: VERSAO_KIT_INICIAL_CLINICA,
    itens: itensAcumulados,
    instaladoEm: marcador?.valor?.instaladoEm ?? agora,
    atualizadoEm: agora,
    origem: origemMarcador
  };
  if (marcador) {
    marcador.valor = novoValor;
    await configuracoes.save(marcador);
  } else {
    await configuracoes.save(configuracoes.create({ tenantId, chave: CHAVE_KIT_INICIAL_CLINICA, valor: novoValor }));
  }

  return {
    reutilizado: false,
    versaoMarcador: VERSAO_KIT_INICIAL_CLINICA,
    materiaisCriados: materiaisNovos.length,
    estruturasHabilitadas: itensAdicionados.filter((chave) => chave.startsWith('estrutura:')),
    itensAdicionados
  };
}
