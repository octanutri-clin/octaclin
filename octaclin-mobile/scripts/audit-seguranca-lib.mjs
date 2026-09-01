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

// Sem RegExp construida em tempo de execucao: o ultimo segmento do caminho e
// comparado como string. Alem de evitar ReDoS por construcao, isso e mais
// preciso do que `includes`, que aceitaria "image-size-extra".
function terminaNoModulo(caminho, modulo) {
  const segmentos = caminho.split('>').map((parte) => parte.trim());
  const ultimo = segmentos[segmentos.length - 1] ?? '';
  const semVersao = ultimo.includes('@', 1) ? ultimo.slice(0, ultimo.lastIndexOf('@')) : ultimo;
  return semVersao === modulo;
}

function validarExcecao(advisory) {
  const excecao = EXCECOES_SEM_CORRECAO.get(advisory.github_advisory_id);
  if (!excecao) return false;

  const caminhos = advisory.findings?.flatMap((finding) => finding.paths ?? []) ?? [];
  const versoes = advisory.findings?.map((finding) => finding.version) ?? [];

  // O pnpm 9 representava "sem correcao publicada" como patched_versions
  // '<0.0.0' e recommendation 'None'. O pnpm 11 usa patched_versions null e
  // omite recommendation. Qualquer outra forma significa que existe correcao
  // e a excecao deixa de valer.
  const semCorrecaoPublicada =
    advisory.patched_versions === '<0.0.0' || advisory.patched_versions === null;
  const semRecomendacaoDeUpgrade =
    advisory.recommendation === 'None' || advisory.recommendation === undefined;

  return (
    advisory.id === excecao.id &&
    advisory.module_name === excecao.modulo &&
    advisory.severity === excecao.severidade &&
    semCorrecaoPublicada &&
    semRecomendacaoDeUpgrade &&
    versoes.length > 0 &&
    versoes.every((versao) => versao === excecao.versao) &&
    caminhos.length > 0 &&
    // O pnpm 9 anotava a versao no caminho ('... > image-size@1.2.1') e o pnpm
    // 11 nao. A versao ja e verificada acima, em `versoes`; aqui o caminho so
    // precisa provar a origem: o modulo chega pelo metro.
    caminhos.every((caminho) => caminho.includes('metro') && terminaNoModulo(caminho, excecao.modulo))
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
