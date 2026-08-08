import type { LinhaImportacaoPaciente } from './cadastros-api';
import { confirmarUploadMidia, solicitarUploadMidia, type TipoMidiaMobile } from './mobile-api';

export interface ResultadoAnexosImportacao {
  linhas: LinhaImportacaoPaciente[];
  confirmados: number;
  naoSelecionados: number;
  falhas: number;
}

function normalizarNomeArquivo(nome: string) {
  return nome.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
}

function dadosDoArquivo(arquivo: File): { tipo: TipoMidiaMobile; mimeType: string; categoria: 'foto' | 'documento' } {
  const extensao = arquivo.name.toLocaleLowerCase('pt-BR');
  const mimeType = arquivo.type || (extensao.endsWith('.pdf') ? 'application/pdf' : '');
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    return { tipo: 'imagem', mimeType, categoria: 'foto' };
  }
  if (mimeType === 'application/pdf') {
    return { tipo: 'documento', mimeType, categoria: 'documento' };
  }
  throw new Error('Formato nao permitido. Selecione JPEG, PNG, WebP ou PDF.');
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : 'falha desconhecida';
}

/**
 * Liga os arquivos locais aos pacientes que acabaram de ser criados. A coluna
 * `anexo` contem somente o nome do arquivo; o binario segue pelo upload
 * assinado e pelas validacoes da Fase 200.
 */
export async function enviarAnexosImportados(
  linhasOriginais: LinhaImportacaoPaciente[],
  arquivos: readonly File[]
): Promise<ResultadoAnexosImportacao> {
  const linhas = linhasOriginais.map((linha) => ({ ...linha, avisos: [...(linha.avisos ?? [])] }));
  const arquivosPorNome = new Map<string, File>();
  for (const arquivo of arquivos) {
    const chave = normalizarNomeArquivo(arquivo.name);
    if (!arquivosPorNome.has(chave)) arquivosPorNome.set(chave, arquivo);
  }

  const pendentes = linhas.filter((linha) => linha.pacienteId && linha.anexo);
  let proximo = 0;
  let confirmados = 0;
  let naoSelecionados = 0;
  let falhas = 0;

  async function processarProximo(): Promise<void> {
    while (proximo < pendentes.length) {
      const indice = proximo;
      proximo += 1;
      const linha = pendentes[indice];
      const arquivo = arquivosPorNome.get(normalizarNomeArquivo(linha.anexo as string));
      if (!arquivo) {
        naoSelecionados += 1;
        linha.avisos.push(`Anexo nao enviado: o arquivo "${linha.anexo}" nao foi selecionado.`);
        continue;
      }

      try {
        const dados = dadosDoArquivo(arquivo);
        const solicitacao = await solicitarUploadMidia({
          pacienteId: linha.pacienteId as string,
          tipo: dados.tipo,
          categoria: dados.categoria,
          nomeArquivo: arquivo.name,
          mimeType: dados.mimeType,
          tamanhoBytes: arquivo.size
        });
        const upload = await fetch(solicitacao.uploadUrl, {
          method: 'PUT',
          headers: solicitacao.uploadHeaders,
          body: arquivo
        });
        if (!upload.ok) throw new Error('O armazenamento recusou o arquivo. Tente novamente.');
        await confirmarUploadMidia(solicitacao.arquivo.id);
        confirmados += 1;
      } catch (erro) {
        falhas += 1;
        linha.avisos.push(`Anexo nao enviado: ${mensagemErro(erro)}`);
      }
    }
  }

  const concorrencia = Math.min(3, pendentes.length);
  await Promise.all(Array.from({ length: concorrencia }, () => processarProximo()));
  return { linhas, confirmados, naoSelecionados, falhas };
}
