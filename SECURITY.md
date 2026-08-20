# Politica de seguranca

## Escopo

Este repositorio contem o codigo-fonte publico do OctaClin. Credenciais,
dados de pacientes, dumps, arquivos `.env` e configuracoes autenticadas nao
fazem parte do escopo publico e nao devem ser enviados em issues, discussoes,
pull requests ou logs de Actions.

## Reportar uma vulnerabilidade

Use o recurso de reporte privado de vulnerabilidade deste repositorio no
GitHub. Nao abra issue publica para uma possivel exposicao de segredo, falha de
autorizacao, isolamento entre tenants, acesso a dados clinicos ou integracao.

Caso o recurso privado esteja indisponivel, envie somente uma descricao minima
para `octaclinsys@gmail.com`. Nao envie dados clinicos reais, senhas, tokens,
cookies, connection strings ou capturas contendo informacao sensivel.

## Resposta esperada

O reporte sera confirmado e classificado antes de qualquer divulgacao publica.
Quando houver segredo possivelmente exposto, ele sera revogado ou rotacionado;
apagar o texto do repositorio nao e uma correcao suficiente.

## Controles do repositorio publico

- Secret Scanning e Push Protection devem permanecer ativos.
- Dependabot Alerts e Dependabot Security Updates devem permanecer ativos.
- Mudancas na `main` passam por pull request e checks obrigatorios.
- Workflows nao podem imprimir secrets e devem usar GitHub Secrets ou variaveis
  de ambiente configuradas fora do Git.
- Antes de cada push, execute `pnpm security:secrets`.

## Fora de escopo

Nao sao aceitos testes destrutivos, acesso a contas de terceiros, engenharia
social, negacao de servico ou qualquer tentativa de acessar dados de pacientes.
