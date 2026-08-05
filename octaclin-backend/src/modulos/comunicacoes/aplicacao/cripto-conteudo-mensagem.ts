import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import {
  PayloadMensagem,
  juntarConteudoMensagem,
  separarConteudoMensagem
} from '../dominio/conteudo-mensagem';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

/**
 * Duas funcoes livres em vez de um servico injetado: quem grava mensagem sao
 * tres classes diferentes (servico, processador da fila e webhook) e todas ja
 * tem — ou passam a ter — a criptografia em maos. Injetar mais um provider so
 * para duas linhas seria cerimonia.
 *
 * **Quando chamar cada uma:**
 *
 * - `aplicarConteudoMensagem` so quando se tem o **payload completo** — criacao
 *   de mensagem. Ela reescreve as duas colunas, entao chamar com um payload
 *   parcial **apaga o conteudo ja cifrado**.
 * - Atualizacao de metadado em linha ja gravada (`resultadoEnvio`,
 *   `ultimoStatusMeta`, `contatoAssociadoEm`) mexe em `payload` direto e nao
 *   encosta em `conteudoCriptografado`. Sao todos campos em claro por definicao.
 * - `lerPayloadMensagem` devolve objeto novo, sem mexer na entidade: quem vai
 *   gravar depois nao corre risco de escrever o conteudo remontado em claro.
 *   `comPayloadCompleto` mexe na entidade e existe so para o caminho de leitura
 *   que devolve a entidade direto para a API.
 */
export function aplicarConteudoMensagem(
  mensagem: Pick<MensagemNotificacaoOrm, 'payload' | 'conteudoCriptografado'>,
  payload: PayloadMensagem,
  criptografia: CriptografiaDadosSensiveis
): void {
  const { metadados, conteudo } = separarConteudoMensagem(payload);
  mensagem.payload = metadados;
  mensagem.conteudoCriptografado = conteudo
    ? criptografia.criptografar(JSON.stringify(conteudo))
    : undefined;
}

/**
 * Remonta o payload como quem disparou entregou.
 *
 * Conteudo ilegivel (chave rotacionada, registro corrompido) devolve so os
 * metadados em vez de derrubar a listagem inteira de mensagens do tenant — a
 * tela de comunicacoes continua abrindo, com a mensagem afetada sem texto.
 */
export function lerPayloadMensagem(
  mensagem: Pick<MensagemNotificacaoOrm, 'payload' | 'conteudoCriptografado'>,
  criptografia: CriptografiaDadosSensiveis
): PayloadMensagem {
  const metadados = mensagem.payload ?? {};
  if (!mensagem.conteudoCriptografado) return metadados;

  try {
    const conteudo = JSON.parse(
      criptografia.descriptografar(mensagem.conteudoCriptografado)
    ) as PayloadMensagem;
    return juntarConteudoMensagem(metadados, conteudo);
  } catch {
    return { ...metadados, conteudoIlegivel: true };
  }
}

/** Entidade com o payload remontado, para devolver a quem le. */
export function comPayloadCompleto<T extends MensagemNotificacaoOrm>(
  mensagem: T,
  criptografia: CriptografiaDadosSensiveis
): T {
  mensagem.payload = lerPayloadMensagem(mensagem, criptografia);
  return mensagem;
}
