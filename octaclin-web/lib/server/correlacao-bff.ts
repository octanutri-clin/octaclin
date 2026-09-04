/**
 * Correlacao de requisicao na fronteira web-backend (EXC-AUD-004).
 *
 * O backend grava `requestId` nos metadados da trilha imutavel
 * `user_action_logs`. Ate aqui o BFF nao propagava `x-request-id`, entao cada
 * salto inventava o proprio identificador: numa investigacao de incidente a
 * linha auditada no backend nao ligava na requisicao que a originou no
 * `octaclin-web`.
 *
 * DECISAO: o identificador gravado na trilha nao pode ser escolhido pelo
 * navegador. Quem entrega essa garantia e o `middleware.ts`: ele emite um id
 * proprio por requisicao e SOBRESCREVE `x-request-id` incondicionalmente antes
 * de a requisicao alcancar qualquer rota de `app/api` - o matcher dele nao abre
 * excecao para `api/`, e ha teste que avalia o matcher real contra essas rotas.
 *
 * Este modulo NAO reimplementa essa garantia; ele nao teria como (ver
 * `normalizarRequestIdBff` abaixo). O que ele faz e menor e complementar:
 * limitar o valor externo ainda aceitavel ao formato exato de UUID emitido
 * aqui.
 *
 * O porque: o valor propagado termina numa trilha que nao pode ser corrigida
 * depois. Aceitar o id do cliente daria a quem envia a requisicao a escolha do
 * identificador gravado - permitindo colidir de proposito com o id de outra
 * investigacao, poluir a trilha com linhas que parecem pertencer a um incidente
 * alheio, ou empurrar conteudo escolhido para dentro de armazenamento imutavel.
 * Preservar o valor do cliente num campo separado tambem foi descartado:
 * exigiria persistir conteudo controlado pelo remetente na mesma trilha
 * imutavel sem nenhum ganho investigativo que o id proprio ja nao ofereca, ja
 * que o navegador hoje nao emite `x-request-id` em nenhum caminho deste
 * repositorio.
 *
 * O identificador e um UUID aleatorio: nao deriva de sessao, cookie, token,
 * tenant, email nem de qualquer dado clinico, entao propaga-lo nao abre um novo
 * canal de vazamento de PHI/PII e nao carrega significado que possa ser lido de
 * volta a partir do log.
 *
 * Alfabeto e tamanho sao propositalmente MAIS restritos que a sanitizacao do
 * backend (`sanitizarRequestId` aceita `[a-zA-Z0-9._:/-]` ate 128 caracteres):
 * 36 caracteres em `[0-9a-f-]` sao um subconjunto estrito, entao o valor sai
 * daqui ja dentro do que o backend aceita e chega sem truncamento nem remocao
 * de caractere - os dois lados enxergam exatamente a mesma string.
 *
 * Este modulo e importado pelo `middleware.ts`, que roda no runtime Edge. Por
 * isso ele nao pode depender de `next/headers` nem de modulos do Node; a
 * leitura do cabecalho da requisicao em curso fica em
 * `correlacao-requisicao-bff.ts`, que ja roda no servidor Node.
 */

export const NOME_CABECALHO_CORRELACAO = 'x-request-id';

const PADRAO_REQUEST_ID_BFF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function criarRequestIdBff(): string {
  return crypto.randomUUID();
}

/**
 * Aceita apenas o formato exato que `criarRequestIdBff` emite; qualquer outra
 * coisa vira um id novo.
 *
 * Isto e rejeicao, nao sanitizacao: limpar caracteres de um valor hostil ainda
 * deixaria quem enviou escolher a maior parte do identificador que vai para a
 * trilha imutavel, que e justamente o que a decisao acima recusa.
 *
 * O QUE ESTA FUNCAO NAO FAZ: distinguir a origem do valor. Um route handler
 * recebe apenas o cabecalho ja montado; nao ha como saber se o UUID que esta la
 * foi posto pelo middleware ou pelo cliente - e o mesmo nome de cabecalho com o
 * mesmo formato, e nenhuma regex separa os dois. Logo, num caminho hipotetico
 * que alcancasse o BFF sem passar pelo middleware, um UUID enviado pelo cliente
 * seria devolvido verbatim. A garantia de que o id nao vem do cliente e do
 * middleware, que sobrescreve incondicionalmente; esta verificacao e o limite
 * residual sobre o valor externo: barra injecao de conteudo escolhido
 * (`../../admin`, `?INJETADO=1`) e valor sem limite de tamanho, que sao o que
 * tornaria a linha da trilha imutavel enganosa ou dificil de ler.
 *
 * Fixar tambem a ORIGEM aqui foi avaliado e descartado: exigiria o middleware
 * emitir um marcador por processo que o cliente nao pudesse adivinhar, e o
 * middleware roda no runtime Edge enquanto as rotas rodam em processos Node
 * distintos - em deploy serverless sao instancias separadas, entao nao existe
 * estado em memoria confiavelmente compartilhado onde o marcador pudesse ser
 * conferido. O guarda que sustenta a garantia continua sendo o matcher do
 * middleware, e e ele que o teste avalia.
 */
export function normalizarRequestIdBff(valor: string | null | undefined): string {
  return valor && PADRAO_REQUEST_ID_BFF.test(valor) ? valor : criarRequestIdBff();
}
