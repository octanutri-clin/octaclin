import { BadRequestException } from '@nestjs/common';
import type { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import type { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';

type DefinicaoPergunta = Pick<PerguntaOrm,
  'categoriaId' | 'tipo' | 'enunciado' | 'peso' | 'obrigatoria'> & {
    configuracao?: Record<string, unknown>;
    opcoes?: (Pick<OpcaoPerguntaOrm, 'rotulo' | 'valor' | 'ordem'> & { imagemUrl?: string | null })[];
  };

/** Recebe somente uma origem já resolvida e autorizada pelo serviço.
 * Não atribui identidade, tenant, chave clínica, ordem ou vínculo à biblioteca.
 * Não normaliza novamente uma configuração salva nem altera seu conteúdo.
 */
export function copiarDefinicaoPergunta(origem: DefinicaoPergunta) {
  return {
    categoriaId: origem.categoriaId,
    tipo: origem.tipo,
    enunciado: origem.enunciado,
    peso: origem.peso,
    obrigatoria: origem.obrigatoria,
    configuracao: structuredClone(origem.configuracao ?? {}),
    visivelBiblioteca: false,
    opcoes: (origem.opcoes ?? []).map((opcao) => ({
      rotulo: opcao.rotulo,
      valor: opcao.valor,
      ...(opcao.imagemUrl !== undefined ? { imagemUrl: opcao.imagemUrl } : {}),
      ordem: opcao.ordem
    }))
  };
}

/** A lista deve estar na ordem autoritativa, lida na mesma transação da cópia.
 * Este plano não escreve no banco nem concede autorização sobre os IDs.
 */
export function planejarInsercaoCopiaPergunta(
  perguntas: readonly { id: string; ordem: number }[], origemId: string, copiaId: string
) {
  const ids = perguntas.map((pergunta) => pergunta.id);
  const indice = ids.indexOf(origemId);
  if (!copiaId || indice < 0 || ids.includes(copiaId) || new Set(ids).size !== ids.length) {
    throw new BadRequestException('Não foi possível preparar a cópia da pergunta. Atualize o questionário.');
  }
  ids.splice(indice + 1, 0, copiaId);
  return ids.map((id, posicao) => ({ id, ordem: posicao + 1 }));
}
