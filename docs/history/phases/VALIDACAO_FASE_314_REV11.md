# Fase 314 — integração REV11 e continuação técnica

## Autorização, base e precedência

Pedido do proprietário em 2026-10-11 autoriza integração, testes e desenvolvimento,
ratifica CL01–10 integralmente e expressamente libera interpretações adultas desde
18 anos completos com domínios próprios. Protocolo REV9 canônico em
[docs/product](../../product/FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md), bytes exatos,
SHA256 `3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a`.
[Aceite não identificável](../../product/FASE_314_ACEITE_CLINICO_G02_REV9_2026-10-11.md).
G02-PROTOCOLO ratificado pelo usuário; formalização institucional separadamente
pendente, sem afirmar assinatura/segunda revisão especializada.

Worktree limpa antes da edição. Branch dedicada `feat/fase-314-validacao-rev11`
criada de `origin/main` HEAD `2e06bcde`, após #392 (`3f448dea`) e #393.
R4: mudança de escrita pediátrica; ciphertext, RLS e schemas existentes preservados.
Nenhuma migration criada/editada. 1068/1069 presentes no código; aplicação externa
não consultada. Testcontainers é PostgreSQL local descartável, sem credenciais externas.
Sem merge, deploy, ativação pediátrica ou migrations em staging/produção.

## Integridade e reprodução

ZIP recebido: SHA256 `f4f31cc5d0ca8716c418c0abb3591d61c25ab4adf5885f9e49e6dd4e71b92c9b`.
Extração conferiu CRC, paths relativos, ausência de symlinks e limite de tamanho.
21 arquivos preservados; manifesto autentica integridade de20 arquivos, não a
identidade/autoria da conversa. Protocolo e aceite em docs/product; demais arquivos
em [revisão REV11](reviews/fase-314-rev11/README_PRIMEIRO.md), sem duplicá-los.
[integracao.json](reviews/fase-314-rev11/integracao.json) mapeia nomes originais.
Arquivos recebidos permanecem imutáveis; resultados reexecutados em subpasta execucao.
Atributos Git restritos aos arquivos de evidência preservam CRLF e espaços Markdown
originais, sem normalizar bytes ou relaxar whitespace do runtime. Os20 hashes
foram reconferidos também contra os blobs staged, além dos arquivos locais.

13 testes Python PASS. Gerador recebido tem um defeito de contador: a variável
`expected` que guardava sete fixtures é sobrescrita pela coluna `z_wfa_publ`;
`len(expected)` retorna10. Wrapper preserva o gerador original e corrige somente o
resumo derivado para7 casos,14 resultados Z,28 verificações Z/percentil. Isso não
transforma essas fixtures em oráculos independentes nem altera as14 entradas
Oxford/28 resultados da investigação anterior.

Scripts originais foram lidos antes de executar em pasta temporária, sem dados ou
credenciais reais. Scripts novos em `scripts/research/fase314` não são dependências
de produto. Os datasets completos não são versionados/embutidos enquanto direitos
permanecerem pendentes. HTML e R remotos não são executados no runtime; fontes R
oficiais de pesquisa têm versão/hash verificados antes da execução em WASM.

## Provas computacionais desta rodada

| Frente | Prova | Resultado e limite |
| --- | --- | --- |
| REV11 recebida | 20 hashes,13 unittest, regeneração isolada | PASS; contador corrigido em evidência derivada |
| OMS2006 amostral em TS | 144 Gold +12 exemplos WHO +4 WFH | PASS; tolerâncias prospectivas5e-5 /0,005 Z |
| OMS2006/2007 integral de quantis |16 XLSX oficiais,14.338 linhas; quantis pelos cabeçalhos SD, inclusive−5 HFA2007 | PASS129.378 comparações; erro máximo0,0005000000000165983; tolerância prospectiva0,0005+1e-10 unidade devido às3 casas dos quantis |
| OMS2007 fontes | 3 TXT oficiais, ambos sexos,804 triplas; âncoras60–229/60–121 | PASS16 XLSX/14.338 linhas e3 TXT/804 triplas, hashes idênticos. Cabeçalho HTTP explícito resolveu403 do CDN;792 triplas XLSX comparadas aos TXT |
| OMS2007 comparação independente | Implementação R original WHO anthroplus/anthro em R4.3.0 via webR0.2.0;11.202 entradas sintéticas | PASS11.184 Z válidos +18 fora de domínio; erro máximo6,572520305780927e-14; tolerância prospectiva1e-8. Testa meses inteiros/meios,±5/±3/±2/0,ambos sexos e limites. 792 triplas XLSX coincidem com TXT; não comprova direitos |
| OMS2006 WFL/WFH independente | WHO anthro R original, toda grade/meios de0,1cm, caudas±5, ambos sexos, normalização730/731 e endpoints | PASS33.652 Z válidos +16 fora de domínio; erro máximo0,0033588044657875127; tolerância prospectiva0,005+1e-10 Z pela saída oficial em2 casas |
| INTERGROWTH independente | 556 casos oficiais Oxford sintéticos; todos260 dias×2 sexos; bordas189/385/448 e caudas | PASS1.112 resultados; erro Z máximo2,886579864025407e-14; percentil1,0302869668521453e-12 pp; tolerâncias1e-8/1e-6 pp |
| INTERGROWTH55s | Novo resultado oficial para4,40kg: Z−3,0088689219142397 | Concordância contínua, não semanal. PDF transcrito4,40 versus equação4,405026478034957; diferença0,005026478kg permanece fora de0,005kg+1e-12 |

A grade semanal arredondada não é interpolada para calcular escores diários.
Concordância com Oxford não substitui precisão/procedência primária dos coeficientes.
Suplemento via editor/els-cdn retornou403 nesta rodada; EuropePMC não apresenta
PMCID/full text aberto para o artigo. Coeficientes permanecem somente nos testes
pesquisa, excluídos do build e fiscalizados pelo guard de artefato.

As provas OMS2006 se complementam: quantis publicados verificam toda a grade;
33.668 entradas contra funções WHO R originais verificam lookup interpolado
L/M/S entre0,1cm, caudas e técnica/ajuste±0,7 na borda730/731. O R retorna
Z arredondado em2 casas; não é prova de igualdade bit a bit do escore bruto.
A adaptação SISVAN aos19 anos e o corte local1856dias são decisões ratificadas
separadas dos domínios estatísticos do código WHO. Direitos permanecem pendentes.

## Contratos implementados

- CL08: seis métodos desde18, sem trocar IMC por idade por corte adulto antes20;
  dados/sexo/faixas individuais e gravidez permanecem controles separados.
- CL10: escrita pediátrica por Professional com carteira e `pacientes.gerenciar`;
  verificação antes de replay. Omitir contexto não contorna a regra quando DOB
  identifica paciente com menos20. Collaborator consulta; SuperAdmin não escreve;
  leituras continuam autorizadas e auditadas pelo fluxo existente.
- Snapshot novo `pediatrico-medidas-v2`: ratificação/protocolo e motivos de G01/direitos;
  v1 preserva estados históricos sem recálculo. Allowlist verifica versão e motivo.
  Contexto neonatal acrescenta elegibilidade explícita/origem, nunca presume `não`.
- Políticas isoladas REV9: roteamento1856/1857, técnica731, categoria civil SISVAN,
  adaptação228, DPP+24/36 meses com prazo inclusivo, OMS independente de exclusãoIG.
- Motor integrado isolado: quatro indicadores parciais, provider explícito,
  plausibilidade/edema por indicador, originais/ajuste/fonte/bruto e percentis por
  família. Sem cliente/env que habilite classificação assistencial. Não aplica
  limiares OMS a IG nem transforma resultado técnico em diagnóstico.
- UI: escrita pediátrica somente Professional, campos de elegibilidade/origem,
  distinção do motivo v1/v2, séries separadas por contexto, sem portal novo.

## Direitos: investigação e pendências objetivas

Fonte primária WHO [copyright](https://www.who.int/about/policies/publishing/copyright)
consultada nesta rodada: usos comerciais de materiais WHO requerem permissão;
licença CC BY-NC-SA3.0IGO, quando aplicável, não autoriza uso comercial. Exceção
para ICD não é autorização para curvas/datasets antropométricos. Solicitação deve
identificar artefatos concretos XLSX/TXT, incorporação e SaaS; não foi enviada.
Licença GPL de anthro/anthroplus é separada da permissão dos materiais/datasets.
Executar funções GPL em ferramenta temporária de pesquisa não insere código GPL
no OctaClin nem declara os datasets licenciados ao produto.

IG: página oficial/calculadora acessíveis, ©Oxford; nenhuma licença comercial
específica encontrada. Página de termos tentada404; artigo/suplemento403.
Metadado histórico CC BY-NC-ND não libera exploração comercial dos artefatos.
MIT growthstandards/GPL gigs não autorizam automaticamente dados científicos.
Precisão primária dos coeficientes + permissão/licenciamento concreto continuam
bloqueantes para incorporar/ativar. É necessário obter confirmação escrita ou
análise jurídica específica; não basta aprovação do proprietário ou disponibilidade pública.

## Gates

| Gate | Estado | Condição restante |
| --- | --- | --- |
| G00-local | PASS | Base/ZIP/contratos conferidos |
| G00-fontes/direitos | BLOCKED | Permissões comerciais concretas OMS/IG; fontes OMS reconferidas |
| G00-operacional | BLOCKED / consulta SKIPPED | Aplicação externa1068/1069 não verificada |
| G01 | BLOCKED, provas computacionais ampliadas PASS | Precisão/procedência primária IG, diferença55s e direitos comerciais |
| G02-protocolo | RATIFICADO_PELO_USUARIO | Nenhuma nova decisão CL genérica solicitada |
| G02-formalização | PENDENTE | Processo institucional em canal protegido; não bloquear desenvolvimento por inferência |
| G03-desenvolvimento | PASS | Autorização vigente para trabalho local/testes/PR |
| G03-ativação | BLOCKED | G01, direitos e autorização de ativação específica |
| G04-local | PASS (checks abaixo) | Não equivale a validação clínica/CI ou liberação assistencial |
| G05 | BLOCKED | Revisão humana independente, CI/ambiente e autorizações operacionais |

## Rollback e revisão

Reverter regras de entrada/retirar formulário preserva snapshots cifrados.
Rollback de aplicação deve conservar leitor v1/v2 para manter acesso ao histórico;
não apagar/recalcular snapshots ou reverter1068/1069 com dados. Nenhum grant novo.
Revisão deste agente não é revisão humana independente R4.

## Checks do código

| Verificação | Estado real |
| --- | --- |
| Python recebido |13 PASS;20 hashes PASS; contador7 casos corrigido em derivado |
| Research TS OMS |8 PASS;129.378 quantis,11.184 Z OMS2007,33.652 Z WFL/WFH e792 triplas XLSX/TXT |
| Backend completo serial | PASS294 suítes/2.648 testes,50 SKIPPED condicionais; inclui os oráculos integrais locais |
| PostgreSQL Testcontainers |31 PASS em banco real descartável, FORCE RLS/role adequada; nenhuma conexão externa |
| Backend typecheck/build/guard de artefatos | PASS; coeficientes IG não entram no build |
| Web typecheck/lint/build | PASS; lint0 erros/65 warnings existentes, aviso middleware preexistente |
| Playwright314/313 desktop/mobile |10 PASS incluindo axe e escrita/leitura por papel |
| Governança raiz |23 comandos PASS; um precisou repetir com PowerShell no PATH |
| Preflight documental |PASS, usando `/tmp/f314-tools/powershell/pwsh -NoProfile -File ./validar-preflight.ps1 -DocsOnly` |
| Secrets / diff whitespace |PASS; repetir após staging final |
| Web BFF/authz completo |PASS,24 comandos,23 relatórios TAP/215 testes; exit0, incluindo BFF314 e regressões312/313 |
| CI / revisão humana independente |PENDENTE na PR Draft #394; revisão do próprio agente não é independente |
| Staging/produção/migrations externas |SKIPPED, não autorizado |

PR de continuação: https://github.com/octanutri-clin/octaclin/pull/394, Draft.

Comandos principais: Node22 Jest `--runInBand` com variáveis G01 locais conforme
README de pesquisa; TypeScript `--noEmit`; pnpm backend build/guard, web
`typecheck`, `lint`, `build`, `test:authz`; Playwright filtro `Fase313|Fase314`.
Governança executou os23 comandos literais do job `governanca` de ci.yml;
metadados sanitizados em `execucao/governanca-local.json`.

Primeira regressão backend:2.644 PASS/1 FAIL/50 SKIPPED; teste TCP ClamAV de30ms
atingiu timeout de conexão sob builds concorrentes. Reexecução isolada10 PASS;
reexecução completa serial2.645 PASS; com novo oráculo WFL/WFH2.646 PASS. Teste novo RED reproduziu aplicação
indevida de caudas a HFA no motor integrado isolado; regra corrigida por indicador,
6 testes focados GREEN, execução completa final2.648 PASS. Esse teste foi
acrescentado durante uma execução da suíte que registrou o RED, sem ocultá-lo.
Nenhum teste foi relaxado ou runtime ClamAV alterado. Os50 SKIPPED são casos
condicionais da suíte completa; PG real foi executado separadamente31 PASS.
Primeira governança:22 comandos PASS/1 FAIL por PowerShell fora do PATH;
repetição de `test:workflows-seguros` com ferramenta já disponível PASS.
Downloads anteriores403 preservados; coleta final24 artefatos PASS com cabeçalho
HTTP explícito e hashes iguais. Não ajustar tolerâncias após testes.

O CodeQL automático da PR identificou expressão incompleta de hostname no
downloader de pesquisa (`.` como curinga). Teste novo RED confirmou aceitação de
domínios semelhantes; pontos escapados corrigem o filtro. Três testes de segurança
PASS (host primário exato, rejeição de semelhantes e de HTTP), sem rede/runtime.
Checks GitHub finais devem ser consultados na PR #394 no HEAD vigente; resultado
da execução anterior não concede aprovação ao novo commit. Scanner automático
não substitui revisão humana independente R4.
