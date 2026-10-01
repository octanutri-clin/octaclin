import { EntityManager } from 'typeorm';
import { MaterialEducativoOrm } from '../../materiais/infraestrutura/material-educativo.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { CHAVE_KIT_INICIAL_CLINICA, VERSAO_KIT_INICIAL_CLINICA } from '../../tenancy/kit-inicial-clinica';

/** Conteudo de uso do produto. Nao contem prescricao ou dado de paciente. */
export const MATERIAIS_KIT_INICIAL = [
  {
    titulo: 'Como acompanhar seu plano no portal',
    resumo: 'Encontre a versão publicada do plano e as orientações da equipe.',
    conteudo: 'Quando a equipe publicar um plano alimentar, ele aparecerá no portal. Leia as orientações registradas pelo profissional e use a conversa segura do portal para enviar dúvidas sobre o acompanhamento.'
  },
  {
    titulo: 'Como registrar hábitos',
    resumo: 'Registre seu acompanhamento para a equipe revisar.',
    conteudo: 'O Registro de hábitos permite informar como foi o acompanhamento do plano. A equipe poderá ler o registro; ele não substitui uma consulta ou resposta profissional.'
  },
  {
    titulo: 'Prepare suas dúvidas para a consulta',
    resumo: 'Organize perguntas para conversar com a equipe.',
    conteudo: 'Antes da consulta, anote suas dúvidas sobre o plano e os registros recentes. Compartilhe essas perguntas com a equipe pelo portal ou durante o atendimento.'
  }
] as const;

/** Chamado somente no ramo de criacao, dentro da transacao de provisionamento. */
export async function instalarKitInicialClinica(
  gerenciador: EntityManager,
  tenantId: string,
  usuarioProprietarioId: string
): Promise<void> {
  const repositorioMateriais = gerenciador.getRepository(MaterialEducativoOrm);
  await repositorioMateriais.save(MATERIAIS_KIT_INICIAL.map((item) => repositorioMateriais.create({
    tenantId,
    criadoPorUsuarioId: usuarioProprietarioId,
    titulo: item.titulo,
    tipo: 'orientacao',
    categoria: 'Uso do portal',
    resumo: item.resumo,
    conteudo: item.conteudo,
    ativo: true
  })));
  const repositorioConfiguracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
  await repositorioConfiguracoes.save(repositorioConfiguracoes.create({
    tenantId,
    chave: CHAVE_KIT_INICIAL_CLINICA,
    valor: { versao: VERSAO_KIT_INICIAL_CLINICA }
  }));
}
