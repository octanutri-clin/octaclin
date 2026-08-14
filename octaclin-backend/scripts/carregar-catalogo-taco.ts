import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fonteDados } from '../src/infraestrutura/banco-dados/fonte-dados';
import {
  calcularSha256Alimentos,
  validarIdentidadeCatalogoTaco
} from '../src/modulos/planos-alimentares/dados/importador-taco';
import type { CatalogoTaco } from '../src/modulos/planos-alimentares/dados/importador-taco';
import { validarMetadadosAtivacaoFonte } from '../src/modulos/planos-alimentares/dominio/governanca-fonte-composicao';
import { AlimentoComposicaoOrm } from '../src/modulos/planos-alimentares/infraestrutura/alimento-composicao.orm';
import { CatalogoComposicaoAlimentoOrm } from '../src/modulos/planos-alimentares/infraestrutura/catalogo-composicao-alimento.orm';
import { FonteComposicaoAlimentoOrm } from '../src/modulos/planos-alimentares/infraestrutura/fonte-composicao-alimento.orm';

const CODIGO_FONTE = 'taco_nepa_unicamp';
const BASE_CODIGO = 'cmvcol_taco3';
const ESQUEMA_VERSAO = 'octaclin-composicao-v1';

function hashRegistro(valor: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex');
}

function numeroOuNulo(valor?: string): number | null {
  if (valor === undefined || valor === null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function sanitizarErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection-string-redigida]')
    .replace(/(password|senha)\s*[=:]\s*\S+/gi, '$1=[redigido]')
    .slice(0, 500);
}

async function executar() {
  if (process.env.TACO_CONFIRMAR_CARGA !== 'true') {
    throw new Error('Defina TACO_CONFIRMAR_CARGA=true para confirmar a carga no banco configurado.');
  }
  const bancoEsperado = process.env.TACO_BANCO_ESPERADO?.trim();
  if (!bancoEsperado) {
    throw new Error('Defina TACO_BANCO_ESPERADO com o nome exato do banco que recebera o catalogo.');
  }
  const responsavelAprovacao = process.env.TACO_RESPONSAVEL_APROVACAO?.trim();
  const direitoUsoReferencia = process.env.TACO_REFERENCIA_DIREITO_USO?.trim();
  if (!responsavelAprovacao || !direitoUsoReferencia) {
    throw new Error(
      'Defina TACO_RESPONSAVEL_APROVACAO e TACO_REFERENCIA_DIREITO_USO antes de ativar o catalogo.'
    );
  }

  const caminho = resolve(__dirname, '../src/modulos/planos-alimentares/dados/catalogo-taco-4a.json');
  const catalogo = JSON.parse(await readFile(caminho, 'utf8')) as CatalogoTaco;
  const identidade = validarIdentidadeCatalogoTaco(catalogo);
  const esquemaNutrientes = {
    baseGramas: 100,
    campos: {
      energiaKcal: 'kcal',
      proteinasG: 'g',
      carboidratosG: 'g',
      lipidiosG: 'g',
      fibrasG: 'g',
      sodioMg: 'mg'
    }
  };
  const governanca = validarMetadadosAtivacaoFonte({
    codigo: CODIGO_FONTE,
    versao: identidade.versaoArtefato,
    baseCodigo: BASE_CODIGO,
    urlArtefato: catalogo.metadados.fonte.urlArquivo,
    checksumArquivo: catalogo.metadados.arquivoOrigem.sha256,
    hashConteudo: identidade.sha256Alimentos,
    esquemaNutrientes,
    direitoUsoReferencia,
    responsavelAprovacao
  });
  await fonteDados.initialize();

  try {
    const [{ nome: bancoAtual } = {}] = (await fonteDados.query(
      'select current_database() as nome'
    )) as { nome?: string }[];
    if (bancoAtual !== bancoEsperado) {
      throw new Error(`Carga recusada: banco conectado e "${bancoAtual ?? 'desconhecido'}", esperado "${bancoEsperado}".`);
    }

    const [tentativa] = (await fonteDados.query(
      `insert into tentativas_importacao_catalogo (
         catalogo_codigo, versao, base_codigo, checksum_arquivo,
         hash_conteudo, status, executor
       ) values ($1, $2, $3, $4, $5, 'em_execucao', $6)
       returning id`,
      [
        governanca.codigo,
        governanca.versao,
        governanca.baseCodigo,
        governanca.checksumArquivo,
        governanca.hashConteudo,
        governanca.responsavelAprovacao
      ]
    )) as Array<{ id: string }>;

    let criada: boolean;
    try {
      criada = await fonteDados.transaction(async (gerenciador) => {
      const catalogos = gerenciador.getRepository(CatalogoComposicaoAlimentoOrm);
      let catalogoFonte = await catalogos.findOneBy({ codigo: governanca.codigo });
      if (!catalogoFonte) {
        catalogoFonte = await catalogos.save(
          catalogos.create({
            codigo: governanca.codigo,
            nome: catalogo.metadados.fonte.nome,
            instituicao: catalogo.metadados.fonte.instituicao,
            urlOficial: catalogo.metadados.fonte.urlPublicacao
          })
        );
      } else if (
        catalogoFonte.nome !== catalogo.metadados.fonte.nome ||
        catalogoFonte.instituicao !== catalogo.metadados.fonte.instituicao ||
        catalogoFonte.urlOficial !== catalogo.metadados.fonte.urlPublicacao
      ) {
        throw new Error('Carga recusada: a identidade da familia TACO diverge do catalogo registrado.');
      }

      const fontes = gerenciador.getRepository(FonteComposicaoAlimentoOrm);
      const fonteExistente = await fontes.findOneBy({
        catalogoId: catalogoFonte.id,
        versao: governanca.versao,
        baseCodigo: governanca.baseCodigo
      });
      const alimentos = gerenciador.getRepository(AlimentoComposicaoOrm);

      if (fonteExistente) {
        if (
          fonteExistente.situacao !== 'ativa' ||
          fonteExistente.codigo !== governanca.codigo ||
          fonteExistente.checksumArquivo !== governanca.checksumArquivo ||
          fonteExistente.hashConteudo !== governanca.hashConteudo ||
          fonteExistente.esquemaVersao !== ESQUEMA_VERSAO
        ) {
          throw new Error('Carga recusada: a versao/base TACO ja existe com identidade ou situacao divergente.');
        }
        const registrados = await alimentos.find({ where: { fonteId: fonteExistente.id } });
        const conteudoRegistrado = registrados
          .map((alimento) => ({
            codigo: Number(alimento.codigoOrigem),
            descricao: alimento.nome,
            categoria: String(alimento.micronutrientes.categoria ?? ''),
            energiaKcal: numeroOuNulo(alimento.energiaKcal),
            proteinaG: numeroOuNulo(alimento.proteinasG),
            lipideosG: numeroOuNulo(alimento.lipidiosG),
            carboidratoG: numeroOuNulo(alimento.carboidratosG),
            fibraG: numeroOuNulo(alimento.fibrasG),
            sodioMg: numeroOuNulo(alimento.sodioMg)
          }))
          .sort((a, b) => a.codigo - b.codigo);
        if (
          conteudoRegistrado.length !== catalogo.alimentos.length ||
          calcularSha256Alimentos(conteudoRegistrado) !== governanca.hashConteudo
        ) {
          throw new Error('Carga recusada: os alimentos persistidos divergem do conteudo versionado da TACO.');
        }
        return false;
      }

      const agora = new Date();
      const fonte = await fontes.save(
        fontes.create({
          catalogoId: catalogoFonte.id,
          codigo: governanca.codigo,
          nome: catalogo.metadados.fonte.nome,
          versao: governanca.versao,
          baseCodigo: governanca.baseCodigo,
          licenca: catalogo.metadados.fonte.licenca.texto,
          urlFonte: catalogo.metadados.fonte.urlPublicacao,
          urlArtefato: governanca.urlArtefato,
          checksumArquivo: governanca.checksumArquivo,
          hashConteudo: governanca.hashConteudo,
          publicadaEm: `${catalogo.metadados.fonte.ano}-01-01`,
          capturadaEm: agora,
          esquemaVersao: ESQUEMA_VERSAO,
          esquemaNutrientes,
          direitoUsoStatus: 'aprovado',
          direitoUsoReferencia: governanca.direitoUsoReferencia,
          direitoUsoAprovadoEm: agora,
          responsavelAprovacao: governanca.responsavelAprovacao,
          situacao: 'em_validacao'
        })
      );

      const [importacao] = (await gerenciador.query(
        `insert into importacoes_catalogo_composicao (
           fonte_versao_id, checksum_arquivo, hash_conteudo, status,
           total_registros, manifesto, executor
         ) values ($1, $2, $3, 'em_execucao', $4, $5::jsonb, $6)
         returning id`,
        [
          fonte.id,
          governanca.checksumArquivo,
          governanca.hashConteudo,
          catalogo.alimentos.length,
          JSON.stringify(catalogo.metadados),
          governanca.responsavelAprovacao
        ]
      )) as Array<{ id: string }>;

      for (let inicio = 0; inicio < catalogo.alimentos.length; inicio += 100) {
        const lote = catalogo.alimentos.slice(inicio, inicio + 100).map((alimento) => {
          const registroCanonico = {
            codigoOrigem: String(alimento.codigo),
            nome: alimento.descricao,
            baseGramas: '100',
            energiaKcal: alimento.energiaKcal === null ? null : String(alimento.energiaKcal),
            proteinasG: alimento.proteinaG === null ? null : String(alimento.proteinaG),
            carboidratosG: alimento.carboidratoG === null ? null : String(alimento.carboidratoG),
            lipidiosG: alimento.lipideosG === null ? null : String(alimento.lipideosG),
            fibrasG: alimento.fibraG === null ? null : String(alimento.fibraG),
            sodioMg: alimento.sodioMg === null ? null : String(alimento.sodioMg),
            micronutrientes: { categoria: alimento.categoria }
          };
          return {
            fonteId: fonte.id,
            importacaoId: importacao.id,
            hashRegistro: hashRegistro(registroCanonico),
            codigoOrigem: registroCanonico.codigoOrigem,
            nome: registroCanonico.nome,
            baseGramas: registroCanonico.baseGramas,
            energiaKcal: registroCanonico.energiaKcal ?? undefined,
            proteinasG: registroCanonico.proteinasG ?? undefined,
            carboidratosG: registroCanonico.carboidratosG ?? undefined,
            lipidiosG: registroCanonico.lipidiosG ?? undefined,
            fibrasG: registroCanonico.fibrasG ?? undefined,
            sodioMg: registroCanonico.sodioMg ?? undefined,
            micronutrientes: registroCanonico.micronutrientes
          };
        });
        await alimentos.insert(lote);
      }

      await gerenciador.query(
        `update importacoes_catalogo_composicao
            set status = 'concluida', concluida_em = now()
          where id = $1`,
        [importacao.id]
      );
      await gerenciador.query("select set_config('app.catalogo_ator', $1, true)", [
        governanca.responsavelAprovacao
      ]);
      await gerenciador.query("select set_config('app.catalogo_motivo', $1, true)", [
        'Carga TACO validada por identidade, esquema e direito de uso.'
      ]);
      await fontes.update({ id: fonte.id }, { situacao: 'ativa' });
      return true;
      });
      await fonteDados.query(
        `update tentativas_importacao_catalogo
            set status = $2, concluida_em = now()
          where id = $1`,
        [tentativa.id, criada ? 'concluida' : 'ignorada']
      );
    } catch (erro) {
      try {
        await fonteDados.query(
          `update tentativas_importacao_catalogo
              set status = 'falhou', erro_sanitizado = $2, concluida_em = now()
            where id = $1`,
          [tentativa.id, sanitizarErro(erro)]
        );
      } catch {
        process.stderr.write('Falha ao registrar a tentativa de importacao do catalogo.\n');
      }
      throw erro;
    }

    process.stdout.write(
      criada
        ? `Catalogo TACO carregado e ativado: ${catalogo.alimentos.length} alimentos.\n`
        : `Catalogo TACO ja estava integro e ativo: ${catalogo.alimentos.length} alimentos.\n`
    );
  } finally {
    await fonteDados.destroy();
  }
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
});
