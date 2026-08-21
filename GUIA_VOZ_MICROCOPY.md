# Guia de voz e microcopy do OctaClin

## Perfil de voz

O OctaClin fala como uma equipe clínica organizada: direto, sereno, respeitoso
e específico. A interface ajuda a concluir uma tarefa sem expor contratos,
códigos internos ou diagnósticos que não pertencem ao contexto do usuário.

- **Direta:** começar pelo que aconteceu ou pela ação disponível.
- **Concreta:** nomear o objeto e a consequência, sem mensagens genéricas.
- **Acolhedora:** orientar a recuperação sem culpar paciente ou profissional.
- **Clínica:** usar termos reconhecíveis na rotina, sem jargão de engenharia.
- **Responsável:** não prometer envio, sincronização ou agendamento antes da
  confirmação do sistema responsável.

## Padrões obrigatórios

| Contexto | Padrão | Exemplo |
|---|---|---|
| Ação | Verbo + objeto | `Salvar alterações` |
| Sucesso | Repetir ação e objeto | `Alterações salvas.` |
| Falha recuperável | O que falhou + próximo passo | `Não foi possível carregar a agenda. Tente novamente.` |
| Estado vazio | Estado + ação possível | `Nenhum formulário pendente. Criar formulário.` |
| Confirmação | Ação + consequência | `Cancelar a consulta e liberar o horário?` |
| Permissão | Capacidade ausente | `Seu perfil não permite editar este prontuário.` |
| Carregamento | Objeto em andamento | `Carregando agenda` |

Erros nunca exibem stack trace, rota interna, identificador de requisição,
token ou resposta bruta do backend em telas clínicas, comerciais ou públicas.
Detalhes técnicos ficam restritos às áreas operacionais do SuperAdmin.

## Glossário canônico

| Evitar | Usar | Observação |
|---|---|---|
| Dashboard | Hoje / Painel clínico | `Hoje` na navegação e título; `Painel clínico` no conteúdo |
| Status | Situação | Exceção: documentação de API e operação técnica |
| Score | Pontuação de risco | Nunca mostrar ao paciente |
| Client | Gestor da clínica | Papel interno continua `Client` |
| Professional | Profissional | Papel interno continua `Professional` |
| Patient | Paciente | Papel interno continua `Patient` |
| SuperAdmin | Administrador geral | Nome interno não deve aparecer na interface comercial |
| ID | Identificador | `ID` somente em operação técnica progressiva |
| Delete | Excluir permanentemente | Informar a consequência |
| Cancelar consulta | Cancelar consulta | Libera o horário e avisa o paciente quando aplicável |
| Desmarcar | Desmarcar | Usado quando a iniciativa é do paciente |
| Arquivar | Arquivar | Preserva histórico; não equivale a excluir |
| Formulário publicado | Versão publicada | Distinguir de rascunho e alterações pendentes |

## Regras editoriais

- Português do Brasil, com acentuação e pontuação completas.
- Sentence case em títulos, botões, abas e rótulos.
- Datas, horas, moeda e números no formato brasileiro.
- Botões usam verbo específico; evitar `OK`, `Sim`, `Enviar` sem objeto e
  confirmações vagas.
- O paciente recebe linguagem simples e não vê classificação ou pontuação de
  risco clínico.
- API, webhook, chave, fila e rastreamento só aparecem em integrações ou
  operações técnicas, com explicação progressiva.

## Garantia automatizada

`pnpm --dir octaclin-web test:linguagem` analisa a AST das telas e componentes.
O teste cobre apenas conteúdo apresentável, para não alterar nomes de rotas,
enums, IDs, chaves ou contratos. Novos termos recorrentes devem ser incluídos
no glossário e no mapa do analisador no mesmo pull request.
