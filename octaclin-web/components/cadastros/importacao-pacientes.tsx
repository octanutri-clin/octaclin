'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Paperclip, Upload } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import {
  LinhaImportacaoPaciente,
  ProfissionalResumo,
  RelatorioImportacaoPacientes,
  importarPacientes
} from '@/lib/cadastros-api';
import { enviarAnexosImportados, type ResultadoAnexosImportacao } from '@/lib/importacao-pacientes-anexos';

interface ImportacaoPacientesProps {
  aberto: boolean;
  profissionais: ProfissionalResumo[];
  aoFechar: () => void;
  aoConcluir: () => void;
}

const ROTULO_SITUACAO: Record<LinhaImportacaoPaciente['situacao'], string> = {
  valido: 'Será criado',
  duplicado: 'Ja cadastrado',
  invalido: 'Com erro',
  limite_plano: 'Fora do limite do plano'
};

const COR_SITUACAO: Record<LinhaImportacaoPaciente['situacao'], string> = {
  valido: 'text-emerald-700',
  duplicado: 'text-texto-suave',
  invalido: 'text-red-700',
  limite_plano: 'text-amber-700'
};

/**
 * Importacao em duas etapas: o arquivo passa pela previa e so vai para o banco
 * depois que a clinica viu, linha a linha, o que sera criado, o que ja existe e
 * o que tem erro. Nada e gravado enquanto o relatorio nao estiver na tela.
 */
export function ImportacaoPacientes({ aberto, profissionais, aoFechar, aoConcluir }: ImportacaoPacientesProps) {
  const [conteudo, setConteudo] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [enviarConvite, setEnviarConvite] = useState(false);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [resultadoAnexos, setResultadoAnexos] = useState<ResultadoAnexosImportacao | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPacientes | null>(null);
  const [importado, setImportado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function reiniciar() {
    setConteudo('');
    setNomeArquivo('');
    setEnviarConvite(false);
    setAnexos([]);
    setResultadoAnexos(null);
    setRelatorio(null);
    setImportado(false);
    setErro(null);
  }

  async function selecionarArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setRelatorio(null);
    setImportado(false);
    setAnexos([]);
    setResultadoAnexos(null);
    setErro(null);
    setNomeArquivo(arquivo.name);
    setConteudo(await arquivo.text());
  }

  async function executar(previa: boolean) {
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await importarPacientes(conteudo, {
        previa,
        profissionalResponsavelId: profissionalId || undefined,
        enviarConvite
      });
      if (!previa && resultado.linhas.some((linha) => linha.pacienteId && linha.anexo)) {
        const uploads = await enviarAnexosImportados(resultado.linhas, anexos);
        resultado.linhas = uploads.linhas;
        setResultadoAnexos(uploads);
      } else {
        setResultadoAnexos(null);
      }
      setRelatorio({ ...resultado });
      setImportado(!previa);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao processar o arquivo.');
    } finally {
      setProcessando(false);
    }
  }

  const linhasComDetalhe = relatorio?.linhas.filter(
    (linha) => linha.situacao !== 'valido' || (linha.avisos?.length ?? 0) > 0 || Boolean(linha.linkConvite)
  ) ?? [];

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => {
        reiniciar();
        aoFechar();
      }}
      titulo="Importar pacientes"
      descricao="Envie um CSV com nome, contato, data de nascimento e, opcionalmente, anexo. Nada e gravado antes da previa."
    >
      <div className="grid gap-4">
        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Arquivo CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="rounded-md border border-linha bg-white p-2 text-sm font-normal text-tinta"
            onChange={(evento) => void selecionarArquivo(evento.target.files?.[0])}
          />
        </label>

        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Profissional responsável
          <select
            className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
            value={profissionalId}
            onChange={(evento) => {
              setProfissionalId(evento.target.value);
              setRelatorio(null);
              setImportado(false);
            }}
          >
            <option value="">Selecione o profissional</option>
            {profissionais.map((profissional) => (
              <option key={profissional.id} value={profissional.id}>
                {profissional.nome}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-texto-suave">
            Se você e o profissional da conta, a importacao usa sempre a sua propria carteira.
          </span>
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-md border border-linha bg-superficie p-3 text-sm text-tinta">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0"
            checked={enviarConvite}
            onChange={(evento) => {
              setEnviarConvite(evento.target.checked);
              setRelatorio(null);
              setImportado(false);
            }}
          />
          <span>
            <strong className="block font-semibold text-texto-forte">Criar convite para o portal</strong>
            Pacientes cujo contato for um e-mail receberao um link de ativacao no relatório.
          </span>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Anexos mencionados no CSV (opcional)
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="rounded-md border border-linha bg-white p-2 text-sm font-normal text-tinta"
            onChange={(evento) => setAnexos(Array.from(evento.target.files ?? []))}
          />
          <span className="text-[11px] font-normal text-texto-suave">
            O nome precisa corresponder a coluna anexo. JPEG, PNG, WebP ou PDF; os limites seguros da Fase 200 continuam valendo.
          </span>
          {anexos.length ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-tinta">
              <Paperclip size={12} /> {anexos.length} arquivo(s) selecionado(s)
            </span>
          ) : null}
        </label>

        {erro ? (
          <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {erro}
          </p>
        ) : null}

        {relatorio ? (
          <div className="grid gap-2 rounded-md border border-linha p-3">
            <p className="text-sm font-semibold text-texto-forte">
              {nomeArquivo ? `${nomeArquivo}: ` : ''}
              {importado
                ? `${relatorio.criados} paciente(s) criado(s) de ${relatorio.total} linha(s).`
                : `Previa de ${relatorio.total} linha(s): ${relatorio.validos} sera(o) criado(s).`}
            </p>
            <p className="text-xs text-texto-suave">
              {relatorio.duplicados} já cadastrado(s) - {relatorio.invalidos} com erro
              {relatorio.bloqueadosPorPlano ? ` - ${relatorio.bloqueadosPorPlano} fora do limite do plano` : ''}
            </p>
            {importado && enviarConvite ? (
              <p className="text-xs text-texto-suave">{relatorio.convitesCriados ?? 0} convite(s) criado(s).</p>
            ) : null}
            {importado && resultadoAnexos ? (
              <p className="text-xs text-texto-suave">
                {resultadoAnexos.confirmados} anexo(s) confirmado(s)
                {resultadoAnexos.naoSelecionados ? ` - ${resultadoAnexos.naoSelecionados} nao selecionado(s)` : ''}
                {resultadoAnexos.falhas ? ` - ${resultadoAnexos.falhas} com falha` : ''}.
              </p>
            ) : null}

            {linhasComDetalhe.length ? (
              <div className="max-h-60 overflow-y-auto rounded-md bg-superficie p-2">
                <ul className="grid gap-1 text-xs">
                  {linhasComDetalhe.map((linha) => (
                    <li key={linha.linha} className="grid gap-1 border-b border-linha/70 py-1.5 last:border-0">
                      <span className="flex flex-wrap gap-x-2">
                        <span className="font-semibold">Linha {linha.linha}</span>
                        <span className={COR_SITUACAO[linha.situacao]}>{ROTULO_SITUACAO[linha.situacao]}</span>
                        <span className="text-texto-suave">
                          {linha.nome ? `${linha.nome}${linha.erros.length ? ' - ' : ''}` : ''}
                          {linha.erros.join(' ')}
                        </span>
                      </span>
                      {(linha.avisos ?? []).map((aviso) => (
                        <span key={aviso} className="flex items-start gap-1 text-amber-800">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {aviso}
                        </span>
                      ))}
                      {linha.linkConvite ? (
                        <a
                          href={linha.linkConvite}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-semibold text-acao hover:underline"
                        >
                          <Link2 size={12} /> Abrir convite de {linha.nome ?? `linha ${linha.linha}`}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 size={14} />
                Nenhuma linha com problema.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Botao
            type="button"
            variante="fantasma"
            onClick={() => {
              reiniciar();
              aoFechar();
            }}
          >
            {importado ? 'Fechar' : 'Cancelar'}
          </Botao>
          {importado ? (
            <Botao type="button" variante="primario" onClick={aoConcluir}>
              Ver pacientes
            </Botao>
          ) : (
            <>
              <Botao type="button" onClick={() => void executar(true)} disabled={!conteudo || processando}>
                {processando ? 'Analisando' : 'Analisar previa'}
              </Botao>
              <Botao
                type="button"
                variante="primario"
                onClick={() => void executar(false)}
                disabled={!relatorio || !relatorio.validos || processando}
              >
                <Upload size={16} />
                {processando ? 'Importando' : `Importar ${relatorio?.validos ?? 0} paciente(s)`}
              </Botao>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
