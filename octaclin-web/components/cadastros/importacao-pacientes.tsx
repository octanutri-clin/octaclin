'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import {
  LinhaImportacaoPaciente,
  ProfissionalResumo,
  RelatorioImportacaoPacientes,
  importarPacientes
} from '@/lib/cadastros-api';

interface ImportacaoPacientesProps {
  aberto: boolean;
  profissionais: ProfissionalResumo[];
  aoFechar: () => void;
  aoConcluir: () => void;
}

const ROTULO_SITUACAO: Record<LinhaImportacaoPaciente['situacao'], string> = {
  valido: 'Sera criado',
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
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPacientes | null>(null);
  const [importado, setImportado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function reiniciar() {
    setConteudo('');
    setNomeArquivo('');
    setRelatorio(null);
    setImportado(false);
    setErro(null);
  }

  async function selecionarArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setRelatorio(null);
    setImportado(false);
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
        profissionalResponsavelId: profissionalId || undefined
      });
      setRelatorio(resultado);
      setImportado(!previa);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao processar o arquivo.');
    } finally {
      setProcessando(false);
    }
  }

  const linhasComProblema = relatorio?.linhas.filter((linha) => linha.situacao !== 'valido') ?? [];

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => {
        reiniciar();
        aoFechar();
      }}
      titulo="Importar pacientes"
      descricao="Envie um CSV com as colunas nome, contato e data de nascimento. Nada e gravado antes da previa."
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
          Profissional responsavel
          <select
            className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
            value={profissionalId}
            onChange={(evento) => setProfissionalId(evento.target.value)}
          >
            <option value="">Selecione o profissional</option>
            {profissionais.map((profissional) => (
              <option key={profissional.id} value={profissional.id}>
                {profissional.nome}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-normal text-texto-suave">
            Se voce e o profissional da conta, a importacao usa sempre a sua propria carteira.
          </span>
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
              {relatorio.duplicados} ja cadastrado(s) - {relatorio.invalidos} com erro
              {relatorio.bloqueadosPorPlano ? ` - ${relatorio.bloqueadosPorPlano} fora do limite do plano` : ''}
            </p>

            {linhasComProblema.length ? (
              <div className="max-h-60 overflow-y-auto rounded-md bg-superficie p-2">
                <ul className="grid gap-1 text-xs">
                  {linhasComProblema.map((linha) => (
                    <li key={linha.linha} className="flex flex-wrap gap-x-2">
                      <span className="font-semibold">Linha {linha.linha}</span>
                      <span className={COR_SITUACAO[linha.situacao]}>{ROTULO_SITUACAO[linha.situacao]}</span>
                      <span className="text-texto-suave">
                        {linha.nome ? `${linha.nome} - ` : ''}
                        {linha.erros.join(' ')}
                      </span>
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
