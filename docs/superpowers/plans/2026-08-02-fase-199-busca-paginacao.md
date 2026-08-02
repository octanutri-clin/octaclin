# Fase 199 - Busca, filtros e paginacao server-side

Status: implementacao local validada; migration, backfill e ensaio com massa
sintetica pendentes em banco explicitamente confirmado.

## Objetivo

Remover o teto invisivel de 25 registros sem expor PII cifrada, preservando o
escopo por tenant e profissional e reutilizando os contratos paginados atuais.

## Decisoes

- Pacientes terao `busca_hashes text[]` com indice GIN. Cada valor e HMAC-SHA256
  de token/prefixo normalizado, incluindo `tenantId` e contexto de dominio.
- A chave HMAC sera derivada de `CRIPTOGRAFIA_CHAVE_AES_256`; nao havera nova
  variavel nem reutilizacao direta da chave AES.
- Busca aceita termos com pelo menos 3 caracteres e combina todos os termos.
  Prefixos sao gerados ate 32 caracteres; busca arbitraria no meio do token nao
  sera prometida.
- A migration cria coluna/indice, mas nao tenta descriptografar dados. Backfill
  sera um comando explicito, idempotente e bloqueado sem confirmacao do banco.
- Questionarios usam `ILIKE` parametrizado porque o titulo nao e cifrado.
- Profissionais recebem paginacao real; busca cifrada de profissional fica fora
  desta fase porque a tela atual nao oferece busca.
- Os filtros de paciente saem do `useMemo` e passam ao backend. A URL continua
  sendo a fonte de verdade da tela.
- O resumo de consultas sera carregado somente para os IDs da pagina retornada,
  sem varredura de pacientes fora dela. Agregacao SQL adicional fica para
  quando medicao real justificar a complexidade.

## Etapas

1. Testar normalizacao, HMAC por tenant e consulta server-side.
2. Criar migration `1013`, mapear a coluna e registrar a sequencia.
3. Manter o indice nas criacoes/alteracoes de nome ou contato.
4. Adicionar busca, filtros e resumo limitado a pagina ao
   servico/controlador de pacientes.
5. Encaminhar os parametros pelo BFF e API web.
6. Adicionar paginacao acessivel nas listas de pacientes e profissionais.
7. Adicionar busca/paginacao de questionarios sem quebrar o workspace do editor.
8. Criar backfill idempotente e validar somente em banco explicitamente
   confirmado.
9. Rodar testes, typechecks, lint, build, scanner de secrets e preflight.
10. Atualizar documentos da fase e preparar PR. Nao integrar antes da migration
    de producao quando `BANCO_EXECUTAR_MIGRACOES=false`.

## Aceite

- Busca encontra paciente fora da primeira pagina e respeita tenant/profissional.
- Filtros e pagina persistem na URL.
- Pacientes, profissionais e questionarios permitem navegar alem de 25 itens.
- Migration possui `up`/`down`, indice GIN e teste de sequencia.
- Backfill nao roda contra URL ambigua.
- Nenhuma busca exige descriptografar todos os pacientes em cada requisicao.
