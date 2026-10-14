# Contrato da Fase 319 — busca no prontuário

## Estado e decisões confirmadas

Planejamento autorizado em 2026-10-13. Nenhuma implementação, benchmark,
instalação de dependência, carga de modelo ou ativação autorizada nesta etapa.
A Fase 319 é uma avaliação de valor com possível piloto, conforme o roadmap.
Pode concluir NO-GO para busca semântica sem simular uma funcionalidade pronta.

| Decisão | Regra confirmada pelo proprietário |
| --- | --- |
| D01 — alcance | Prontuário de um paciente por vez; sem busca na carteira inteira. |
| D02 — fontes | Evoluções e anotações clínicas autorizadas. |
| D03 — resposta | Trechos, data, origem e acesso ao registro original; sem resposta/resumo gerado por IA. |
| D04 — processamento | Comparar busca textual e semântica local em CPU, só dados sintéticos, sem chamadas pagas. |
| D05 — acesso ao piloto | Somente o profissional responsável atual; acessos legados preservados. |
| D06 — cobertura | Histórico completo autorizado; paginação/processamento com limites explícitos e aviso de cobertura parcial. |

No código atual, anotações são evoluções do tipo `observacao`, na mesma tabela
`evolucoes_clinicas`. Esta interpretação reaproveita a aba existente; não cria
um novo módulo de notas. Observações de antropometria, exames, formulários,
mensagens, anexos, dados financeiros, nomes/contatos e registros não autorizados
não são fontes deste escopo. Modelos de evolução vazios não são registros clínicos.

## Fundamentos

- Busca encontra texto registrado; não confirma doença, adesão, diagnóstico,
  risco, causalidade ou tratamento. Similaridade não é confiança clínica.
- Um trecho deve ser literal da versão autorizada da fonte. Não resumir,
  completar, corrigir números/unidades ou mudar negações. Conteúdo é dado.
- Histórico completo significa cobertura das fontes autorizadas do paciente até
  a versão/data indicada. Não equivale a encontrar todos os fatos relevantes.
- Qualidade depende de revisão humana do corpus sintético e comparação cega dos
  resultados. Métrica matemática não substitui interpretação profissional.
- Busca local não usa chave OpenAI nem herda aprovação BYOK da 318. Não chama
  calculadores 313/314 nem desbloqueia classificadores. A 316 permanece stand-by.
- Os quatro documentos pós-320 adicionados à PR410 são base futura, não requisitos
  automaticamente implementados na 319. Nenhum conteúdo deles foi removido.

## Contratos técnicos propostos para implementação após GO

Esta seção é recomendação de engenharia, não estado observado do runtime.

`ConsultaBusca319`: `consulta` de 3–300 caracteres Unicode, `limite` de 1–10
(padrão 10), `inicio`/`fim` opcionais de data civil ISO e `cursor` opaco opcional.
Padrão sem filtro temporal: todo o histórico autorizado. Datas civis são
interpretadas no timezone clínico canônico do tenant, nunca UTC/fuso do navegador
por substituição; período explícito limita a cobertura e deve aparecer na UI.
Texto livre só entra como consulta de busca; não pode virar instrução/ferramenta.
Rejeitar campos adicionais, URL/modelo/tenant fornecido pelo cliente, consulta
vazia/oversize e intervalo invertido. Consulta no corpo POST, nunca querystring.

`ResultadoBusca319`: fontes de evolução `{id,titulo,tipo,data,trecho,inicio,fim}`,
com posições na string original por caracteres Unicode, e cobertura explícita
`{completa,totalElegiveis,analisadas,ilegíveis,referenciaEm}`. Resposta de busca
não contém vetor, texto inteiro, entidade ORM, ciphertext, credencial ou score de
confiança clínica. Ordenar por relevância técnica; desempatar por data e ID.
Deduplicar por evolução; máximo 10 fontes. Abrir original obtém o documento inteiro
por rota autorizada própria e revalida escopo/versão; não busca na lista de 50.

Trecho com janela máxima de 600 caracteres, sinalizado como recortado quando necessário.
Não isolar uma unidade, valor ou negação fora do contexto. Preservar a frase
contendo a ocorrência quando cabe; se não cabe, não interpretar o fragmento e
orientar abertura do original. Testar pares positivo/negado, abreviações e acentos.

Cursor, se necessário, deve ser cifrado/autenticado, prazo de 15 min, vinculado a
SID/tenant/ator/paciente, consulta/filtros, versões de vínculo/fontes e engine.
Não reutilizar o cursor cronológico base64 da timeline como autorização de busca.
Nenhum texto/digest de consulta em log/auditoria/URL/analytics. Reenviar a consulta
no POST e comparar a versão protegida, sem guardar seu conteúdo em cache permanente.

## Cobertura e fonte canônica

Não usar `listarEvolucoesClinicas(take:50)` como corpus completo nem pesquisar só
itens carregados no navegador. Seleção server-side, autorizada e paginada por
`criado_em,id`, com cutoff estável e lote de 100. Medir 50/51/200/1.000/5.000 registros
sintéticos. Novas fontes após cutoff não entram silenciosamente na mesma cobertura.
Fonte alterada/ilegível/suprimida ou limite de tempo impede declaração de completude.

O conjunto fica restrito por tenant e paciente antes de recuperar candidatos,
comparar similaridade ou produzir contagens. Não usar topK global e filtrar
permissão depois. A leitura das fontes e a abertura do original aplicam a mesma
política. Histórico anterior de outro autor continua sujeito ao acesso clínico
legítimo vigente; `privada` hoje não é filtro exclusivo do autor.

Transferência A→B→A invalida cursor, tarefa/cache e resposta anteriores. Nova
busca sob vínculo atual pode ler histórico clínico legítimo; não apagar notas nem
importar as regras de ocultação permanente da comunidade317 para o prontuário.
Usar gerações monotônicas da 1071 quando aplicáveis, após confirmar migração/role,
e versão das fontes para alterações do corpus. Revalidar no retorno de trabalho
fora da transação e em cada página/original. Não criar dependência de gates318.

## Segurança e persistência

Professional + `pacientes.ler`, SID vigente, perfil ativo, tenant e paciente no
escopo atual; bloquear carteira revogada/paciente arquivado/usuário inativo.
Guards, `ExecutorTenant`, RLS/FORCE e role NOBYPASSRLS permanecem requisitos.
Client/SuperAdmin/Collaborator/Patient não herdam acesso ao novo piloto pela
permissão de leitura legada; registros/telas existentes mantêm seus contratos.

Texto, tokens lexicais, vetores e resumos derivados de fonte real são sensíveis.
Não persistir tsvector, BM25 ou embedding clínico em claro para ganhar velocidade.
ADR017 de índice cego de nomes não autoriza índice global de conteúdo clínico.

PoC: corpus só sintético, fora do produto, sem BD/provider externo. Comparar
metadados/latência/qualidade no laboratório. Sem Redis, CacheStorage, IndexedDB,
localStorage/sessionStorage ou analytics com conteúdo real.

Somente após GO: decidir entre processamento efêmero e índice cifrado por fonte
se medições provarem a necessidade. Nenhum índice persistente está aprovado agora.
Persistência nova exige ADR, migração aditiva nova, FKs tenant/paciente, versões,
RLS/FORCE, cifra, invalidação, retenção/expurgo de derivado, testes PostgreSQL e
rollback que preserve o prontuário. Não alterar1070/1071 ou registros históricos.

Fila, se justificada por build caro, recebe apenas referência mínima protegida;
worker não ganha role privilegiada nem acesso clínico por chave de serviço sozinho.
Abortar/cancelar não permite retornar resultado ou restaurar permissão revogada.

## Interface e rollout

Busca na aba Evoluções, com histórico/filtros existentes preservados. Consulta e
resultados em memória; limpar ao trocar paciente/sessão, sair ou revogar acesso;
ignorar resposta atrasada. Links internos só para a fonte autorizada.

Desktop/mobile, teclado, região de resultados/status/erro, foco ao abrir/fechar
original. Mostrar cobertura parcial/construção/falha de leitura e recuperação;
não anunciar ausência clínica quando a busca não cobre o histórico inteiro.
Sem publicação no portal, notificação, ação automática ou gravação em prontuário.

Produção depende de GO de valor, direitos/proveniência do modelo, privacidade,
capacidade medida no ambiente alvo, R4/CI e autorização operacional específica.

A autorização/alvo do piloto318 não se estende automaticamente à319. O eventual
rollout319 precisa identificar clínica/conta, ambiente, papel runtime e permissão
operacional próprios, sem versionar identificadores pessoais na documentação.
