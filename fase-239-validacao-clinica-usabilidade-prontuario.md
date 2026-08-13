# Fase 239 - Validacao clinica e de usabilidade do prontuario

Status: validacao tecnica concluida em 2026-08-13. O aceite clinico humano
continua separado e obrigatorio antes de ampliar o uso para pacientes reais.

## Objetivo

Confirmar que o prontuario profissional organiza a jornada clinica sem perda de
contexto, sem exposicao indevida ao portal e sem regressao entre desktop e
mobile. Esta fase nao certifica diagnostico, prescricao, dose ou protocolo
clinico.

## Cobertura automatizada

O comando abaixo executa a regressao do prontuario com APIs mockadas e dados
inteiramente sinteticos nos projetos `desktop-chromium` e `mobile-chromium`:

```powershell
pnpm --dir octaclin-web test:prontuario:validacao
```

Em 2026-08-13, a suite concluiu `18/18` testes aprovados. Ela cobre:

- Areas e subareas do prontuario, incluindo navegacao por teclado entre abas e
  ausencia de overflow horizontal.
- Linha de cuidado, historico filtravel, atalhos frequentes e protecao contra
  sair com evolucao ainda nao salva.
- Evolucao privada, tarefa de acompanhamento, materiais, anexo clinico e
  declaracao limitada a consulta concluida.
- Jornada sintetica de conduta terapeutica: rascunho, publicacao, versao 2,
  arquivamento, preservacao do historico e indicacao de que o conteudo nao vai
  ao portal neste incremento.

## Criterios de aceite clinico humano

Um Professional autorizado deve revisar somente um paciente de teste e marcar
o aceite quando confirmar que:

1. A proxima acao, a agenda e a linha de cuidado sao compreensiveis sem abrir
   telas tecnicas.
2. Registrar evolucao, tarefa, material e anexo nao induz a perda de rascunho
   nem mistura registros privados com conteudo do portal.
3. A declaracao e oferecida somente para consulta concluida e possui os dados
   institucionais esperados antes de imprimir ou enviar.
4. Condutas terapeuticas sao tratadas como registro profissional versionado,
   sem sugestao automatica de dose, produto ou formula e sem exposicao ao
   paciente.
5. A navegacao principal e as subabas podem ser usadas por teclado e permanecem
   legiveis em tela pequena.

O aceite humano nao deve inserir informacao clinica real, imagem real, anexo
real ou acionar envio de comunicacao. Ele nao substitui protocolo clinico,
consentimento, revisao juridica ou validacao regulatoria.

## Limites e proximos passos

- A Fase 238 permanece opcional e bloqueada por protocolo gestacional
  especifico, curvas, consentimentos e limites de uso aprovados.
- A expansao a pacientes reais depende do aceite clinico humano acima, dos
  gates de go-live ja registrados e da configuracao juridica e operacional.
