# Fase 241 - Hardening da IA clinica

Status: concluida no PR `#40`; rollout permanece desabilitado.

## Objetivo

Fechar as fronteiras de seguranca, privacidade e confiabilidade do modulo de IA
antes de qualquer oferta comercial. Esta fase nao habilita IA em producao, nao
adiciona provedor clinico real e nao inclui o aplicativo Mobile legado.

## Decisoes

- O PR draft `#6` foi usado apenas como referencia. Ele mistura uma base antiga
  de Mobile e IA e nao deve ser integrado diretamente.
- Somente `SuperAdmin` e `Professional` acessam IA. O profissional permanece
  limitado aos pacientes sob sua responsabilidade; `Collaborator` fica fora
  ate existir atribuicao clinica explicita e testada.
- Resultado de IA e sugestao, nasce com revisao humana pendente e nao pode gerar
  conduta clinica autonoma.
- `ia.clinica` continua fail-closed e desabilitada por padrao.

## Entrega

### Referencias clinicas e midia privada

- Check-in informado para sentimento deve pertencer ao mesmo tenant e paciente.
- Transcricao deve pertencer ao tenant e seu arquivo confirmado deve pertencer
  ao mesmo paciente; o texto da transcricao nao e carregado pela validacao.
- Reconhecimento alimentar aceita somente `pacienteId` e `arquivoMidiaId` no
  contrato publico. URL e base64 fornecidos pelo navegador foram removidos.
- O backend valida imagem confirmada, tenant, paciente, tipo e SHA-256; somente
  depois gera URL privada com cinco minutos de validade.
- O microservico deve devolver exatamente o hash validado. Divergencia invalida
  toda a resposta.

### Confiabilidade e abuso

- Lock transacional por tenant, paciente e hash serializa reconhecimentos
  concorrentes; o cache e relido apos o lock.
- Limites por tenant/usuario: 30 analises de sentimento e 20 reconhecimentos em
  15 minutos.
- Texto de sentimento limitado a 5.000 caracteres.
- Chamada interna usa timeout configuravel entre 1 e 60 segundos, resposta
  limitada a 512 KiB durante a leitura e validacao estrutural antes de persistir.
- Erros externos sao sanitizados; corpo do provedor, URL assinada, token e texto
  clinico nao entram na mensagem retornada.

### Autenticacao entre servicos

- `IA_SERVICE_TOKEN` e obrigatorio nos dois servicos, com no minimo 32
  caracteres, comparado em tempo constante pelo FastAPI.
- Endpoints POST falham fechados sem configuracao e exigem Bearer; `/health`
  permanece publico.
- `IA_SERVICE_TIMEOUT_MS` tem padrao de 15 segundos.

### Experiencia do profissional

- O campo tecnico de UUID e a entrada de URL foram substituidos por uma selecao
  das imagens confirmadas do paciente.
- A interface mostra nome/data e orienta o upload no prontuario quando nao ha
  imagem elegivel.
- Revisao humana, fonte e limitacoes permanecem visiveis.

## Banco de dados

Nao ha migration. `transcricoes_midia` existe desde a fundacao; esta fase apenas
adiciona seu mapeamento ORM para validar IDs sem carregar conteudo sensivel.

## Validacao local

- Backend focado: 2 suites/15 testes; suite completa: 130 suites/870 testes;
  typecheck e build aprovados.
- Servico IA: 6 testes de contrato/autenticacao.
- Web: lint, typecheck, build de 122 rotas.
- Playwright: modulo avancado completo em desktop/mobile, 8/8; revisao humana
  e selecao de imagem confirmada cobertas nos dois viewports.
- Seguranca: scanner de secrets limpo; `nanoid` transitivo elevado para 3.3.18
  apos advisory alto e audits de producao backend/web zerados.
- `git diff --check` aprovado.
- Remoto: CI `31749993251` aprovou Backend, Web, Mobile, FastAPI, rollout,
  operacao e o smoke visual completo.

## Gate operacional

Antes de habilitar no tenant piloto:

1. configurar o mesmo segredo dedicado no backend e no servico IA;
2. confirmar POST sem token `401` e chamada autenticada `200` com dados
   sinteticos;
3. manter o Mobile desligado;
4. habilitar `ia.clinica` apenas no tenant piloto;
5. observar Rollout e desabilitar a flag diante de timeout, 5xx ou contrato
   invalido.

## Pendencias fora da fase

- Provedor de IA clinica real, avaliacao de qualidade e governanca de modelos.
- Agregacao distribuida de telemetria antes de multiplas instancias.
- Modernizacao do Mobile legado, registrada separadamente na Fase 243.
