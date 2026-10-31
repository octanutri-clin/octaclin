export const pacienteId = 'paciente-pa06-sintetico';
export const planoIds = ['plano-pa06-a', 'plano-pa06-b'];
export const idsRefeicoes = ['refeicao-pa06-a', 'refeicao-pa06-b'];
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];

function resumo(id, titulo, versaoId, ativoParaPaciente = true) {
  return { id, pacienteId, profissionalId: 'profissional-sintetico', titulo, ativoParaPaciente, ativacaoRevisao: 1,
    criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z',
    current: { id: versaoId, numero: 1, status: 'publicada', publicadoEm: '2026-10-15T12:00:00.000Z', criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z', refeicoes: [] },
    historico: [{ id: versaoId, numero: 1, status: 'publicada', publicadoEm: '2026-10-15T12:00:00.000Z' }] };
}

export function resultado(itens, ferroEstado = 'parcial') {
  const codigos = ['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg','calcioMg','magnesioMg','manganesMg','fosforoMg','ferroMg','potassioMg','cobreMg','zincoMg','selenioMcg','retinolMcg','vitaminaAReMcg','vitaminaARaeMcg','tiaminaMg','riboflavinaMg','vitaminaB6Mg','niacinaMg','niacinaNeMg','vitaminaB12Mcg','folatoDfeMcg','vitaminaDMcg','vitaminaEAlfaTocoferolMg','vitaminaCMg'];
  const nutrientes = Object.fromEntries(codigos.map(codigo => [codigo, {
    codigo, unidade: codigo.endsWith('Mcg') ? 'mcg' : codigo === 'energiaKcal' ? 'kcal' : codigo.endsWith('Mg') ? 'mg' : 'g',
    estado: codigo === 'energiaKcal' || codigo === 'calcioMg' ? 'completo' : 'indisponivel',
    ...(codigo === 'energiaKcal' ? { total: itens * 100 } : codigo === 'calcioMg' ? { total: 0 } : {}),
    ...(codigo === 'ferroMg' && ferroEstado === 'parcial' ? { estado: 'parcial', quantidadeConhecida: 1.2, itensComValor: 1, itensIncluidos: itens } : { itensComValor: 0, itensIncluidos: itens })
  }]));
  return { motorVersao: 'pa06-combinado-v1', estado: itens ? 'calculado' : 'sem_itens_incluidos', itensIncluidos: itens, nutrientes, exclusoes: [], calculadoEm: '2026-10-16T12:00:00.000Z', publicacoes: [] };
}

export async function prepararConsole(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route(url => url.pathname === '/api/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001', tenantSlug: 'clinica-sintetica', email: 'profissional@example.test', expiraEm: '2026-10-30T12:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  await page.route(url => url.pathname === '/api/profissionais', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-sintetico', nome: 'Profissional sintético' }], total: 1 }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/prontuario`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    paciente: { id: pacienteId, tenantId: 'tenant-sintetico', profissionalResponsavelId: 'profissional-sintetico', nome: 'Paciente sintético', statusAdesao: 'aderente' },
    resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
  }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] }) }));
  await page.route(url => ['/api/planos-alimentares/modelos', '/api/planos-alimentares/receitas'].includes(url.pathname), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 }) }));
  const planos = [resumo(planoIds[0], 'Plano A sintético', 'versao-a'), resumo(planoIds[1], 'Plano B sintético', 'versao-b'), resumo('plano-pa06-off', 'Plano desativado sintético', 'versao-off', false)];
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: planos, total: planos.length, pagina: 1, limite: 25 }) }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoIds[0]}` || url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoIds[1]}`, route => {
    const caminho = new URL(route.request().url()).pathname;
    const plan = planos.find(item => caminho.endsWith(item.id));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plan, current: { ...plan.current, apresentacaoEstado: 'configurada', preferenciasApresentacao: { schemaVersao: 1, profissional: {}, paciente: {} }, ativacaoRevisao: 1, ativoParaPaciente: true, ativacaoRefeicoes: [], resumoRefeicoesAtivas: { estado: 'completo', energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 }, totais: { energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 }, calculo: { metaEnergeticaKcal: 1800, metasMacronutrientes: { carboidratosG: 225, proteinasG: 90, gordurasG: 60 } }, refeicoes: [] } }) });
  });
}

