const EXCECOES_SEM_CORRECAO = new Map([
  [
    'GHSA-w3rx-r6r6-pgpr',
    {
      id: 1138808,
      modulo: 'image-size',
      versao: '1.2.1',
      severidade: 'high',
    },
  ],
  [
    'GHSA-5p2g-fcmc-qvqq',
    {
      id: 1138809,
      modulo: 'image-size',
      versao: '1.2.1',
      severidade: 'high',
    },
  ],
]);

function validarExcecao(advisory) {
  const excecao = EXCECOES_SEM_CORRECAO.get(advisory.github_advisory_id);
  if (!excecao) return false;

  const caminhos = advisory.findings?.flatMap((finding) => finding.paths ?? []) ?? [];
  const versoes = advisory.findings?.map((finding) => finding.version) ?? [];

  return (
    advisory.id === excecao.id &&
    advisory.module_name === excecao.modulo &&
    advisory.severity === excecao.severidade &&
    advisory.patched_versions === '<0.0.0' &&
    advisory.recommendation === 'None' &&
    versoes.length > 0 &&
    versoes.every((versao) => versao === excecao.versao) &&
    caminhos.length > 0 &&
    caminhos.every((caminho) => caminho.includes('metro') && caminho.includes('image-size@1.2.1'))
  );
}

export function avaliarAuditoria(relatorio) {
  const totais = relatorio.metadata?.vulnerabilities;
  const metadadosValidos =
    totais &&
    ['info', 'low', 'moderate', 'high', 'critical'].every((chave) => Number.isInteger(totais[chave]));

  if (!metadadosValidos || relatorio.error) {
    return {
      aprovado: false,
      excecoes: [],
      mensagem: 'Auditoria reprovada. Relatorio ausente, incompleto ou com erro.',
    };
  }

  const advisories = Object.values(relatorio.advisories ?? {});

  if (advisories.length === 0) {
    const semVulnerabilidades = Object.values(totais).every((total) => total === 0);
    return semVulnerabilidades
      ? { aprovado: true, excecoes: [], mensagem: 'Auditoria sem vulnerabilidades.' }
      : {
          aprovado: false,
          excecoes: [],
          mensagem: 'Auditoria reprovada. Contadores indicam vulnerabilidades sem advisory correspondente.',
        };
  }

  const inesperados = advisories.filter((advisory) => !validarExcecao(advisory));
  const excecoes = advisories.filter(validarExcecao).map((advisory) => advisory.github_advisory_id);
  const contagemEsperada =
    totais.high === EXCECOES_SEM_CORRECAO.size &&
    (totais.critical ?? 0) === 0 &&
    (totais.moderate ?? 0) === 0 &&
    (totais.low ?? 0) === 0 &&
    (totais.info ?? 0) === 0;
  const semAvisosSilenciados = (relatorio.muted ?? []).length === 0;
  const conjuntoCompleto =
    excecoes.length === EXCECOES_SEM_CORRECAO.size &&
    excecoes.every((id) => EXCECOES_SEM_CORRECAO.has(id));

  if (inesperados.length > 0 || !contagemEsperada || !semAvisosSilenciados || !conjuntoCompleto) {
    const ids = inesperados.map((advisory) => advisory.github_advisory_id ?? advisory.id).join(', ');
    return {
      aprovado: false,
      excecoes,
      mensagem: `Auditoria reprovada. Vulnerabilidades novas ou excecoes divergentes: ${ids || 'metadados divergentes'}.`,
    };
  }

  return {
    aprovado: true,
    excecoes,
    mensagem:
      'Auditoria aprovada com duas excecoes upstream sem versao corrigida em image-size. Distribuicao mobile permanece bloqueada.',
  };
}
