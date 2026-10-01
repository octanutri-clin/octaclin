import { fonteDados } from '../src/infraestrutura/banco-dados/fonte-dados';
import {
  calcularHashConteudoCatalogo,
  calcularHashRegistroCatalogo,
  validarCatalogoFonte,
  type CatalogoFonteNormalizado,
  type RegistroCatalogoFonte
} from '../src/modulos/planos-alimentares/dados/catalogo-composicao-fonte';
import { validarMetadadosAtivacaoFonte } from '../src/modulos/planos-alimentares/dominio/governanca-fonte-composicao';
import { validarAlvoCargaCatalogo } from '../src/modulos/planos-alimentares/dominio/validar-alvo-carga-catalogo';
import { AlimentoComposicaoOrm } from '../src/modulos/planos-alimentares/infraestrutura/alimento-composicao.orm';
import { CatalogoComposicaoAlimentoOrm } from '../src/modulos/planos-alimentares/infraestrutura/catalogo-composicao-alimento.orm';
import { FonteComposicaoAlimentoOrm } from '../src/modulos/planos-alimentares/infraestrutura/fonte-composicao-alimento.orm';

export interface OpcoesCargaCatalogo {
  bancoEsperado: string;
  roleEsperada: string;
  responsavelAprovacao: string;
  direitoUsoReferencia: string;
}

function numeroOuNulo(valor?: string | null): number | null {
  return valor === undefined || valor === null ? null : Number(valor);
}

function sanitizarErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection-string-redigida]')
    .replace(/(password|senha)\s*[=:]\s*\S+/gi, '$1=[redigido]')
    .slice(0, 500);
}

function registrosPersistidos(alimentos: AlimentoComposicaoOrm[]): RegistroCatalogoFonte[] {
  return alimentos
    .map((alimento) => {
      const registro: RegistroCatalogoFonte = {
        externalId: alimento.codigoOrigem,
        nome: alimento.nome,
        baseGramas: Number(alimento.baseGramas),
        nutrientes: {
          energiaKcal: numeroOuNulo(alimento.energiaKcal),
          proteinasG: numeroOuNulo(alimento.proteinasG),
          carboidratosG: numeroOuNulo(alimento.carboidratosG),
          lipidiosG: numeroOuNulo(alimento.lipidiosG),
          fibrasG: numeroOuNulo(alimento.fibrasG),
          sodioMg: numeroOuNulo(alimento.sodioMg)
        },
        metadadosOrigem: (alimento.micronutrientes?.metadadosOrigem ?? {}) as Record<string, unknown>
      };
      if (alimento.preparacao) registro.preparacao = alimento.preparacao;
      return registro;
    })
    .sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
}

function esquemaNutrientes(catalogo: CatalogoFonteNormalizado): Record<string, unknown> {
  return {
    baseGramas: 100,
    escalaNumerica: 8,
    campos: {
      energiaKcal: 'kcal',
      proteinasG: 'g',
      carboidratosG: 'g',
      lipidiosG: 'g',
      fibrasG: 'g',
      sodioMg: 'mg'
    },
    metadadosOrigem: catalogo.fonte.metadadosOrigem ?? {}
  };
}

export async function persistirCatalogoFonte(
  catalogo: CatalogoFonteNormalizado,
  opcoes: OpcoesCargaCatalogo
): Promise<'criado' | 'ja-integro'> {
  validarCatalogoFonte(catalogo);
  const governanca = validarMetadadosAtivacaoFonte({
    codigo: catalogo.fonte.codigo,
    versao: catalogo.fonte.versao,
    baseCodigo: catalogo.fonte.baseCodigo,
    urlArtefato: catalogo.fonte.urlArtefato,
    checksumArquivo: catalogo.fonte.checksumArquivo,
    hashConteudo: catalogo.fonte.hashConteudo,
    esquemaNutrientes: esquemaNutrientes(catalogo),
    direitoUsoReferencia: opcoes.direitoUsoReferencia,
    responsavelAprovacao: opcoes.responsavelAprovacao
  });

  await fonteDados.initialize();
  try {
    const [{ nome: bancoAtual, usuario: roleAtual } = {}] = (await fonteDados.query(
      'select current_database() as nome, current_user as usuario'
    )) as { nome?: string; usuario?: string }[];
    validarAlvoCargaCatalogo({
      bancoAtual: bancoAtual ?? '',
      roleAtual: roleAtual ?? '',
      bancoEsperado: opcoes.bancoEsperado,
      roleEsperada: opcoes.roleEsperada
    });
    const [tentativa] = (await fonteDados.query(
      `insert into tentativas_importacao_catalogo (
         catalogo_codigo, versao, base_codigo, checksum_arquivo,
         hash_conteudo, status, executor
       ) values ($1, $2, $3, $4, $5, 'em_execucao', $6)
       returning id`,
      [governanca.codigo, governanca.versao, governanca.baseCodigo, governanca.checksumArquivo,
        governanca.hashConteudo, governanca.responsavelAprovacao]
    )) as Array<{ id: string }>;

    let criada = false;
    try {
      criada = await fonteDados.transaction(async (gerenciador) => {
        const catalogos = gerenciador.getRepository(CatalogoComposicaoAlimentoOrm);
        let catalogoFonte = await catalogos.findOneBy({ codigo: governanca.codigo });
        if (!catalogoFonte) {
          catalogoFonte = await catalogos.save(catalogos.create({
            codigo: governanca.codigo,
            nome: catalogo.fonte.nome,
            instituicao: catalogo.fonte.instituicao,
            urlOficial: catalogo.fonte.urlFonte
          }));
        } else if (
          catalogoFonte.nome !== catalogo.fonte.nome ||
          catalogoFonte.instituicao !== catalogo.fonte.instituicao ||
          catalogoFonte.urlOficial !== catalogo.fonte.urlFonte
        ) {
          throw new Error('Carga recusada: identidade da fonte diverge do catálogo registrado.');
        }

        const fontes = gerenciador.getRepository(FonteComposicaoAlimentoOrm);
        const fonteExistente = await fontes.findOneBy({
          catalogoId: catalogoFonte.id,
          versao: governanca.versao,
          baseCodigo: governanca.baseCodigo
        });
        const alimentosRepository = gerenciador.getRepository(AlimentoComposicaoOrm);
        if (fonteExistente) {
          if (
            fonteExistente.situacao !== 'ativa' ||
            fonteExistente.codigo !== governanca.codigo ||
            fonteExistente.checksumArquivo !== governanca.checksumArquivo ||
            fonteExistente.hashConteudo !== governanca.hashConteudo ||
            fonteExistente.esquemaVersao !== catalogo.fonte.esquemaVersao ||
            fonteExistente.direitoUsoReferencia !== governanca.direitoUsoReferencia
          ) {
            throw new Error('Carga recusada: versão/base já existe com identidade, direito ou situação divergente.');
          }
          const existentes = await alimentosRepository.find({ where: { fonteId: fonteExistente.id } });
          if (
            existentes.length !== catalogo.registros.length ||
            calcularHashConteudoCatalogo(registrosPersistidos(existentes)) !== governanca.hashConteudo
          ) {
            throw new Error('Carga recusada: registros persistidos divergem do conteúdo versionado.');
          }
          return false;
        }

        const agora = new Date();
        const fonte = await fontes.save(fontes.create({
          catalogoId: catalogoFonte.id,
          codigo: governanca.codigo,
          nome: catalogo.fonte.nome,
          versao: governanca.versao,
          baseCodigo: governanca.baseCodigo,
          licenca: catalogo.fonte.licenca,
          urlFonte: catalogo.fonte.urlFonte,
          urlArtefato: governanca.urlArtefato,
          checksumArquivo: governanca.checksumArquivo,
          hashConteudo: governanca.hashConteudo,
          capturadaEm: new Date(catalogo.fonte.capturadaEm),
          esquemaVersao: catalogo.fonte.esquemaVersao,
          esquemaNutrientes: esquemaNutrientes(catalogo),
          direitoUsoStatus: 'aprovado',
          direitoUsoReferencia: governanca.direitoUsoReferencia,
          direitoUsoAprovadoEm: agora,
          responsavelAprovacao: governanca.responsavelAprovacao,
          situacao: 'em_validacao'
        }));
        const [importacao] = (await gerenciador.query(
          `insert into importacoes_catalogo_composicao (
             fonte_versao_id, checksum_arquivo, hash_conteudo, status,
             total_registros, manifesto, executor
           ) values ($1, $2, $3, 'em_execucao', $4, $5::jsonb, $6)
           returning id`,
          [fonte.id, governanca.checksumArquivo, governanca.hashConteudo, catalogo.registros.length,
            JSON.stringify({ fonte: catalogo.fonte, metadados: catalogo.fonte.metadadosOrigem ?? {} }),
            governanca.responsavelAprovacao]
        )) as Array<{ id: string }>;

        for (let inicio = 0; inicio < catalogo.registros.length; inicio += 100) {
          const lote = catalogo.registros.slice(inicio, inicio + 100).map((registro) => ({
            fonteId: fonte.id,
            importacaoId: importacao.id,
            hashRegistro: calcularHashRegistroCatalogo(registro),
            codigoOrigem: registro.externalId,
            nome: registro.nome,
            preparacao: registro.preparacao,
            baseGramas: String(registro.baseGramas),
            energiaKcal: registro.nutrientes.energiaKcal === null ? undefined : String(registro.nutrientes.energiaKcal),
            proteinasG: registro.nutrientes.proteinasG === null ? undefined : String(registro.nutrientes.proteinasG),
            carboidratosG: registro.nutrientes.carboidratosG === null ? undefined : String(registro.nutrientes.carboidratosG),
            lipidiosG: registro.nutrientes.lipidiosG === null ? undefined : String(registro.nutrientes.lipidiosG),
            fibrasG: registro.nutrientes.fibrasG === null ? undefined : String(registro.nutrientes.fibrasG),
            sodioMg: registro.nutrientes.sodioMg === null ? undefined : String(registro.nutrientes.sodioMg),
            micronutrientes: { metadadosOrigem: registro.metadadosOrigem }
          }));
          await alimentosRepository.insert(lote);
        }
        await gerenciador.query(
          `update importacoes_catalogo_composicao set status = 'concluida', concluida_em = now() where id = $1`,
          [importacao.id]
        );
        await gerenciador.query("select set_config('app.catalogo_ator', $1, true)", [governanca.responsavelAprovacao]);
        await gerenciador.query("select set_config('app.catalogo_motivo', $1, true)", [
          `Carga governada ${governanca.codigo}, ${governanca.versao}; direito: ${governanca.direitoUsoReferencia}.`
        ]);
        await fontes.update({ id: fonte.id }, { situacao: 'ativa' });
        return true;
      });
      await fonteDados.query(
        `update tentativas_importacao_catalogo set status = $2, concluida_em = now() where id = $1`,
        [tentativa.id, criada ? 'concluida' : 'ignorada']
      );
      return criada ? 'criado' : 'ja-integro';
    } catch (erro) {
      try {
        await fonteDados.query(
          `update tentativas_importacao_catalogo set status = 'falhou', erro_sanitizado = $2, concluida_em = now() where id = $1`,
          [tentativa.id, sanitizarErro(erro)]
        );
      } catch {
        process.stderr.write('Falha ao registrar a tentativa de importação do catálogo.\n');
      }
      throw erro;
    }
  } finally {
    await fonteDados.destroy();
  }
}
