import { EntityManager } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { aplicarConteudoMensagem } from './cripto-conteudo-mensagem';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

export interface EntradaAvisoPlanoPublicado {
  tenantId: string;
  pacienteId: string;
  planoId: string;
  versaoId: string;
}

/** Registra o aviso do portal e o despacho externo dentro da transação de publicação. */
export async function registrarAvisoPlanoPublicado(
  gerenciador: EntityManager,
  criptografia: CriptografiaDadosSensiveis,
  entrada: EntradaAvisoPlanoPublicado
): Promise<void> {
  const { tenantId, pacienteId, planoId, versaoId } = entrada;
  const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
  const chaveIdempotencia = `plano-publicado:${pacienteId}:${versaoId}:portal`;
  const existente = await repositorioMensagens.findOne({
    select: { id: true },
    where: { tenantId, chaveIdempotencia }
  });
  if (existente) return;

  const aviso = repositorioMensagens.create({
    tenantId,
    pacienteId,
    canalId: undefined,
    templateId: undefined,
    status: 'enviado',
    categoria: 'administrativo',
    chaveIdempotencia,
    payload: {}
  } as Partial<MensagemNotificacaoOrm>);
  aplicarConteudoMensagem(aviso, {
    canal: 'portal',
    evento: 'plano_publicado_portal',
    assunto: 'Seu plano alimentar está disponível',
    texto: 'Um novo plano alimentar está disponível no portal. Acesse a seção Plano alimentar para consultá-lo.'
  }, criptografia);
  await repositorioMensagens.save(aviso);

  const repositorioOutbox = gerenciador.getRepository(OutboxEventoOrm);
  await repositorioOutbox.save(repositorioOutbox.create({
    tenantId,
    tipo: 'plano_alimentar.publicado',
    status: 'pendente',
    payload: { pacienteId, planoId, versaoId }
  }));
}
