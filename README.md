# Clinic+ B2B

Projeto de catalogo, carrinho e pedido para a Clinic+, construido com Vite, React e TypeScript.

## Visao geral
- Catalogo publico com busca, filtros e detalhes do produto
- Carrinho de interesse com observacoes por item
- Formulario de pedido com validacoes de cliente e endereco
- Area de login, conta e admin
- Integracao com Supabase para dados, auth, storage e tipos
- Integracao serverless com Proxis em `api/proxis-order.ts`
- Exportacao FOCCO em TXT com TPR do cliente em `tabVenda` e condicao de pagamento a vista (`356`)
- Resend Proxis validado para a filial `5`

## Taxonomia do catalogo
Sao tres eixos independentes:

- **Marca** (`product_brands`) — quem assina: Chá Mais, Clinic Mais
- **Categoria** (`product_types`) — como se consome: Chá, Cápsula, Solúvel
- **Subcategoria** (`product_families`) — o que e: Camomila, Creatina, Whey

Subcategoria e **global** desde `20260731140000`: a mesma serve qualquer
categoria, cadastrada uma vez so. A coluna `product_families.type_id` continua
no banco apenas como historico e nao e lida por nenhum caminho do app.

## Imagens do catalogo
Formato do catalogo: **4:5 retrato**. O catalogo e inteiro de pote, lata e caixa
— formatos verticais. Num quadro 1:1 sobrava ~23% de largura vazia dos dois
lados, e era isso que fazia o produto parecer pequeno no meio de um fundo
grande. E o mesmo formato da referencia aprovada pelo cliente (Essential
Nutrition entrega em 1308 × 1636).

| Uso | Master | Observacao |
| --- | --- | --- |
| Produto | 1280 × 1600 px (4:5) | minimo 1000px no menor lado · produto em ~85% do quadro |
| Banner do catalogo | 1920 × 600 px (16:5) | arte de borda a borda · peca de celular: 800 × 320 |
| Notificacao | 1200 × 400 px (3:1) | |

O upload entrega o arquivo **ja fechado em 1280 × 1600**, em WebP. A foto entra
inteira, sem corte, e a faixa que sobraria e preenchida esticando a propria
borda dela — nao uma cor chapada, porque fundo de estudio quase sempre tem
gradiente e cor chapada deixaria um degrau visivel onde a foto termina.

Isso existe para resolver o "a foto tem fundo proprio, mas o site e branco":
enquanto o arquivo chega numa proporcao qualquer, sobra faixa vazia dentro da
moldura e aparece a emenda entre os dois fundos. Resolvido no arquivo, a vitrine
so precisa exibir — `ProductImageFrame` nao tem padding e usa `object-cover`.

Tratar isso no CSS foi tentado e descartado: ou corta o produto, ou inventa um
fundo que nao e o da foto (chegou a existir um desfoque de apoio, removido).

Para as fotos subidas antes disso: `node scripts/normalize-stored-images.mjs`
roda o mesmo tratamento sobre o que ja esta no storage, sem apagar o original —
a versao tratada sobe com sufixo `-4x5`. O algoritmo mora em
`scripts/lib/fillImageToFrame.mjs` e espelha `normalizeProductImageFile`; se os
dois divergirem, a foto reenviada pelo admin para de bater com a do script.

Cada produto declara como a foto ocupa a moldura (`image_fit`):

- `cover` — padrao: a foto preenche o quadro
- `contain` — foto que nao pode perder nada nas bordas

`image_alts` guarda a descricao de cada foto, alinhada por indice com
`image_urls`.

> ⚠️ **Base atual fora do padrao.** Em 31/07/2026 as 143 imagens ativas tinham
> entre 121 e 900px no menor lado (93 delas abaixo de 300px), contra o minimo de
> 1000px. Fechar o quadro nao inventa resolucao: ate as fotos serem reenviadas,
> o zoom da galeria rende pouco e `srcset` nao traz ganho — nao ha de onde
> reduzir.

## Tipografia
Uma familia so (Inter Variable) e uma escala so, em `src/lib/typography.ts`.
Consuma por papel (`TEXT.label`, `TEXT.body`, `TEXT.sectionTitle`), nao por
medida — foi a falta de nome de papel que fez cada tela reinventar a sua.

| Degrau | Tamanho | Onde |
| --- | --- | --- |
| `micro` | 10px | selo, contador |
| `caption` | 11px | rotulo, metadado |
| `small` | 12px | apoio em componente denso |
| `compact` | 13px | corpo de formulario e tabela |
| `body` | 14px | corpo padrao |
| `reading` | 16px | leitura corrida |
| `title` / `sectionTitle` / `pageTitle` / `display` | 18 / 20 / 24 / 30px | titulos |

Pesos: `normal`, `medium`, `semibold`. `bold` e `black` saem de cena — a
hierarquia se resolve em semibold, e o preto sobrava so onde uma area quis
gritar mais que as outras.

Rotulo em caixa alta tem uma forma unica: `TEXT.label` (11px, semibold,
`tracking-[0.18em]`). Antes eram 24 combinacoes para o mesmo elemento, com
espacamento de 0,08em a 0,32em.

> Levantamento de 31/07/2026, antes e depois: 34 tamanhos distintos -> 14 (11
> degraus mais 3 `clamp()` de titulo responsivo); 26 valores fora da escala ->
> 6; 24 formas de rotulo -> 2; 5 pesos -> 3.

## Molduras de imagem
Cada tipo de imagem tem a sua moldura, declarada em
`productImageNormalization.ts` (`PRODUCT_IMAGE_FRAME`, `BANNER_IMAGE_FRAME`,
`NOTIFICATION_IMAGE_FRAME`). Quem chama `uploadProductImageFile` precisa dizer
qual — o mesmo upload atende produto, banner e notificacao, e as tres tem
proporcoes diferentes.

Banner e notificacao **nao** passam por moldura no upload: so reduzem para caber
num teto (`BANNER_IMAGE_MAX_SIZE`, `NOTIFICATION_IMAGE_MAX_SIZE`) e viram WebP.
Forcar proporcao ali esticaria a borda de uma peca que ja esta certa —
enquadrar e decisao da tela. So a foto de produto tem moldura imposta, porque o
card tem tamanho fixo e a foto precisa preenche-lo.

### Formato do banner: AVIF na frente, WebP atras
O banner e a primeira imagem da home, entao e ela que decide o LCP. A vitrine
serve os dois formatos via `<picture>`; o navegador pega o primeiro que entende.
`catalog_banners.image_url_avif` guarda a versao AVIF — o `<source>` so e emitido
quando ela existe, porque `<picture>` cai para o `<img>` por falta de suporte ao
formato, nunca por erro de rede.

Medido no arquivo oficial de 1920x600 entregue pelo time de design, erro medio
por canal contra o PNG original:

| Formato | Tamanho | Erro |
| --- | --- | --- |
| webp q85 | 269 KB | 4,53 |
| webp q92 | 387 KB | 4,07 |
| **avif q63** | **257 KB** | **3,01** |
| avif q70 | 338 KB | 2,26 |

AVIF q63 e menor que o WebP de reserva **e** um terco mais fiel. O WebP ficou em
q85: de 0,85 para 0,92 o arquivo cresce 44% e o erro cai 10% — nao aparece na
tela, aparece no carregamento.

Isso vale para banner. Foto de produto continua em WebP q85 sem AVIF: sao 169
arquivos, e o ganho por imagem e pequeno perto do custo de manter duas versoes
de cada uma.

### Areas promocionais
A pagina alterna a quantidade de pecas por bloco, contando o banner do topo:
**1, 3, 1, 2, 1**. Bloco sempre igual vira ruido de fundo — variando, cada um
volta a ser uma pausa. O ultimo e uma peca so, a maior do site, isolada: e o
lugar da campanha principal.

Os blocos ficam em `PromoBanners.tsx`. Sem arte, cada espaco se desenha com a
medida escrita dentro.

A sangria e por margem negativa (`ml-[calc(50%_-_50vw)]`), nunca por `position`
ou `transform`: esses dois brigam com o `sticky` da coluna de filtros.

Especificacao para o time de design: `docs/ESPECIFICACAO-BANNERS.md`.

Formatos iguais repetidos anulam a hierarquia: no bento, o tamanho da celula e
que ranqueia o que importa. Todos entram **depois** da navegacao — banner que a
atrapalha custa mais do que rende.

A sangria da faixa e por margem negativa (`ml-[calc(50%_-_50vw)]`), nunca por
`position` ou `transform`: esses brigam com o `sticky` da coluna de filtros.

Especificacao para o time de design: `docs/ESPECIFICACAO-BANNERS.md`.

### Proporcoes
**1920 x 600 (16:5)** e a medida do banner. E o arquivo que o time de design
entrega, e a vitrine usa exatamente essa proporcao — a arte cabe inteira, sem
corte e sem ampliacao. `BANNER_IMAGE_MAX_SIZE` fica em 1920 pelo mesmo motivo:
acima disso so haveria arquivo maior, sem um pixel a mais de detalhe.

O jogo oficial traz tambem **800 x 320 (5:2)** para celular, guardada em
`image_url_mobile`. Nao e a mesma arte redimensionada: sao enquadramentos
diferentes, com o texto reposicionado. O `<picture>` decide arte e formato de uma
vez — o par de celular vem antes no HTML porque o navegador para no primeiro
`<source>` que satisfaz media **e** formato.

A arte precisa ocupar o arquivo inteiro. Peca com margem branca embutida aparece
como espaco vazio dentro do quadro, e nenhum ajuste de CSS resolve isso.

DPI nao interessa aqui: navegador ignora esse metadado. O que vale sao os pixels.

Na tela a moldura tambem e fixa, nunca proporcional. Na pagina do produto a
coluna de midia e travada em 34rem: em `fr` ela crescia com o monitor e a foto
passava de 538x672, mais que o dobro do maior card do catalogo. No catalogo o
teto vem da grade (203px a 347px por card, conforme a faixa).

## Largura das paginas publicas
`PAGE_CONTAINER`, em `src/lib/pageLayout.ts`. Catalogo, pagina do produto, ajuda,
pedido e pedido concluido usam o mesmo limite de 1400px — antes so o catalogo e a
pagina do produto paravam ali.

Cabecalho, rodape e banner ficam de fora: sao faixas, e faixa se estende de ponta
a ponta. Admin e area do cliente tambem, por serem telas de trabalho que ganham
em usar a tela toda.

## Zoom da foto do produto
Amplia dentro da propria moldura, no ponto do cursor (`ProductZoomImage`). O
modal saiu do desktop: ele existia porque a foto era pequena demais para se olhar
de perto, e com 1280px isso deixou de ser verdade.

O fator maximo e **calculado, nao escolhido**: a foto e entregue com 1280px e
aparece com ~456px, entao acima de 2,8x o navegador passaria a inventar pixel. A
Baymard e clara nisso — o que separa um zoom util de um inutil nao e o mecanismo,
e a imagem ampliada sair nitida.

No celular nao ha "passar o mouse": o toque abre a galeria ampliada, que e onde o
gesto de pinca funciona.

## Previa do produto no admin
A previa nao reproduz a loja: ela renderiza os componentes da loja.

- previa do catalogo = o proprio `CatalogProductCard`, na largura real da coluna
- previa da pagina = `ProductMediaGallery`, `ProductDescription` e a mesma escala
  tipografica que a pagina usa

`buildPreviewProduct` converte o formulario num `Product` para isso ser possivel.
A versao anterior remontava card e pagina a mao, em mais de 400 linhas paralelas
que envelheciam a cada mudanca no catalogo — e a previa passou a mostrar uma loja
que nao existia mais.

E o mesmo caminho que a Shopify segue: nao existe "previa desenhada", existe a
loja aberta em modo de conferencia.

## Botoes e controles do catalogo
Tres formas, e so tres:

| Classe | Raio | O que e |
| --- | --- | --- |
| Acionavel | `rounded-full` | botao, chip de filtro, select, gatilho de menu |
| Linha de lista | `rounded-lg` | item dentro de menu, popover ou painel lateral |
| Miniatura de midia | `rounded-xl` | thumbnail de foto, alinhado a moldura que abre |

Sem raio proprio: seta de rolagem sobre gradiente, estrela de avaliacao, ponto
do carrossel — nao tem fundo, entao nao tem forma a alinhar. Cabecalho de
acordeao herda o raio do cartao que preenche.

Variante segue hierarquia, nao decoracao: `default` para a acao principal da
area, `outline` para a secundaria ao lado dela, `ghost` para acao de apoio
dentro de lista. `destructive` e vermelho (hue 359) e fica reservado a acao que
destroi algo — nao serve para navegacao.

## Descricao do produto
Duas origens convivem: texto cru vindo do ERP e HTML escrito no editor do admin.
`hasAuthoredStructure` separa os dois. O texto cru passa por inferencia de
blocos (paragrafo e lista a partir das quebras de linha); o HTML formatado sai
como veio, so higienizado — inferir sobre ele apagava titulo, negrito e
numeracao, e quebrava paragrafo longo em uma frase por bloco.

Paragrafo nao tem margem: o Enter avanca exatamente uma linha, como em qualquer
editor de texto. Quem separa assunto e o titulo (h2/h3), que mantem a folga
acima. Na tela, quebra de linha e paragrafo ficam iguais — a diferenca continua
no HTML, que e o que leitor de tela e buscador usam para saber onde um
paragrafo termina.

Atalhos do editor: **Enter** abre paragrafo, **Shift+Enter** quebra a linha
dentro dele, e **Backspace** no inicio da linha volta de um para o outro em dois
estagios (paragrafo -> quebra de linha -> emendado), em vez de emendar o texto
de uma vez. Ver `joinAsLineBreak.ts`.

A tipografia mora em `src/lib/productDescriptionStyles.ts` e e usada pelo editor
do admin **e** pela vitrine. Enquanto cada lado tinha a sua, quem escrevia via um
texto mais forte do que o publicado e formatava sobre uma amostra que nao
correspondia ao resultado. Ajuste sempre nesse arquivo.

Atencao: o admin higieniza a descricao **antes de gravar**. Tag fora da
allowlist de `richTextPure.ts` nao e apenas escondida — e destruida no
salvamento.

## Precos por cliente
Tres camadas, nessa ordem: **tabela do cliente no Proxis** (pelo `proxis_tpr_id`)
-> **tabela geral do tipo de cliente** (o preco cheio) -> **preco de cadastro**.
As tabelas do Proxis sao parciais de proposito — a 8728 lista 138 dos 143
produtos — e a camada do meio e o que faz o que falta sair pela politica
comercial em vez do cadastro.

`ObterTabelasPreco` e o endpoint do ProManager que devolve as tabelas com os
itens dentro (`ite_numero` = codigo do produto, `tit_preco` = preco). A rota
`api/proxis-price-tables` lista e importa; a area **Precos** do admin mostra cada
tabela com quantos itens tem no Proxis, quantos batem com o catalogo e se ja
foram importados. Na lista de produtos, cada linha diz se o preco vem da tabela
ou do cadastro.

> **Preco zero nao e preco.** Numa tabela do Proxis, zero significa "nao
> precificado aqui". Em 31/07/2026 a tabela 8728 estava com 143 dos 156 itens em
> zero no nosso banco, contra 165 itens e **nenhum** zero na origem — a
> importacao anterior e que estava quebrada. `buildCustomerPriceMap` descarta
> zero e negativo, e `normalizeProxisPriceTable` tambem.

Dois cuidados que ja custaram caro:

- a consulta da tabela geral precisa de `is("proxis_tpr_id", null)`. Sem isso ela
  trazia toda linha do mesmo `customer_type` — inclusive as das tabelas 8728,
  8744 e 8745 — e o preco exibido virava o da ultima linha que o banco
  devolvesse;
- o mapa vazio de "ainda nao carregou" e `EMPTY_PRICE_MAP`, uma instancia so.
  `new Map()` na chamada devolve objeto novo a cada render e o React aborta com
  "Maximum update depth exceeded".

## Existir no Proxis e ter preco numa tabela sao coisas diferentes
Duas perguntas que se confundem com facilidade:

- **o item existe no ERP?** — `ObterItens`, o cadastro de produto. Se nao existe,
  ele e descartado do pedido (ver abaixo);
- **esta tabela define preco para ele?** — `ObterTabelasPreco`. Se nao define, o
  produto sai pelo preco de cadastro do catalogo.

O produto 7592 (CalMais Alga Lithothamnium) e o exemplo: existe no ERP
(`ite_id=13449`, ativo) e tem preco nas tabelas 8744 e 8745, mas **nao** na 8728.
Na tela da 8728 ele aparece como "Preco de cadastro", e esta certo.

Tabela do Proxis e parcial por natureza — a 8728 precifica 138 dos 143 produtos
do catalogo.

## Produto sem cadastro no Proxis
Item que o ERP nao conhece e **descartado** no envio do pedido: o cliente pedia
cinco produtos e o Proxis recebia quatro, sem ninguem ser avisado — o
`failed_products` so era lido no reenvio manual do admin.

Duas defesas, nessa ordem:

1. **Na origem.** O formulario do produto confere o codigo no ERP
   (`api/proxis-item-check`) enquanto se digita, e a pendencia entra no score de
   preenchimento. `found: null` e "nao deu para saber" e nao barra nada — ERP
   fora do ar nao pode reprovar cadastro correto.
2. **No pedido.** Se ainda assim escapar, o pedido segue com os itens validos e o
   descarte fica registrado junto do status de enviado.

O aviso **nao** vira status "pendente": isso jogaria o pedido na fila de reenvio
e ele sairia duplicado.

Recusar o pedido inteiro por causa de um item foi descartado — travaria a venda
dos outros quatro por um problema de cadastro.

> O filtro de busca de item e `item.ite_numero`, com o prefixo `item.`. Sem ele o
> ProManager devolve vazio para qualquer codigo, e a checagem passa a reprovar
> tudo.

## API do Proxis: o que existe
Levantado por sondagem em 31/07/2026 — o `ServerFunctionInvoker` do DataSnap
esta desabilitado, entao nao ha como listar os metodos.

| Leitura | Escrita |
| --- | --- |
| `ObterItens` · `ObterParticipantes` · `ObterPedidos` | `SalvarParticipante` |
| `ObterTabelasPreco` · `ObterFamilias` | `SalvarPedidoVenda` |
| `ObterFormasPagamento` · `ObterFiliais` | `SalvarItem` |

**Nao existe gravacao de preco.** `SalvarTabelaPreco`, `SalvarItemTabelaPreco`,
`AtualizarTabelaPreco` e `SalvarPreco` respondem "method not found", e
`ObterItens` traz 57 campos sem nenhum de preco — o item nao carrega tabela.

Por isso a tabela do Proxis e somente leitura no admin: aceitar edicao criaria um
preco que o ERP desconhece, e a proxima importacao o apagaria sem aviso. O pedido
formal para a Proxsys esta em `docs/PEDIDO-PROXSYS-GRAVACAO-PRECO.md`.

## Sincronia do pedido com o Proxis
O pedido e gravado no Supabase antes de ir ao ERP, entao o site e a fonte de
verdade e nenhuma venda se perde quando o Proxis esta instavel. O desfecho do
envio fica registrado no proprio pedido (`proxis_status`), e nao so num aviso de
tela:

- `pendente` — ainda nao confirmado no ERP; aparece no filtro **Pendentes no ERP**
- `enviado` — confirmado pelo `SalvarPedidoVenda`
- `erro` — o ERP recusou; o motivo fica em `proxis_error`
- `legado` — pedidos anteriores a essa mudanca, sem registro de desfecho

Quem grava esse status e a propria rota serverless, usando `SUPABASE_SERVICE_ROLE_KEY`
(o RLS de `orders` so permite UPDATE para admin, e o cliente pode fechar a aba no
meio do envio).

O `doc_ped_web` e derivado do `submission_key` do pedido, entao toda tentativa
reivindica o mesmo documento. Antes de gravar, a rota consulta o `ObterPedidos`
por esse documento: reenviar pelo painel nunca duplica o pedido no ERP. Falhas
passageiras (rede, 5xx) sao repetidas automaticamente; o que sobrar cai na fila
de pendentes.

Aplique `supabase/APLICAR_NO_SUPABASE_orders_proxis_sync.sql` antes de subir esta
versao — sem a funcao `record_proxis_order_sync` o envio continua funcionando,
mas sem registro de status.

## Estrutura principal
- `src/pages/` para rotas e orquestracao
- `src/components/catalogo/` para a experiencia do catalogo
- `src/components/carrinho/` para o carrinho
- `src/components/pedido/` para o formulario de pedido
- `src/components/admin/` para o painel administrativo
- `src/components/shared/` para componentes reutilizaveis
- `src/components/ui/` para a base visual
- `src/hooks/` para dados e comportamentos
- `src/lib/` para regras de negocio e transformacoes
- `src/integrations/supabase/` para cliente e tipos
- `supabase/` para migrations, SQLs e seed
- `scripts/` para rotinas e apoio operacional
- `documentation/` como apoio local de contexto, planejamento e mapa do projeto

## Verificacao
```
npm run typecheck   # tsc -b --noEmit
npm run gen:types   # regenera src/integrations/supabase/types.ts
npm test            # vitest
npm run build       # vite build
```

> **O typecheck precisa do `-b`.** O `tsconfig.json` usa project references com
> `"files": []`: um `tsc --noEmit` direto nao verifica arquivo nenhum e sai com
> codigo 0. Foi assim que seis `Cannot find name` chegaram a producao — entre
> eles o `onSearchSubmit` da busca do catalogo, que lancava ReferenceError ao
> apertar Enter.

Restam 63 erros de tipagem, catalogados por causa e esforco em
`docs/PLANEJAMENTO-ERROS-TIPAGEM.md`. Nenhum e `Cannot find name`.

## Dependencias e comandos
Instale as dependencias com:

```bash
npm install
```

Inicie o frontend e as rotas `/api/*` locais usando o proxy n8n com:

```bash
npm run dev
```

Para chamar a Proxis diretamente, sem passar pelo n8n, use:

```bash
npm run dev:local
```

Abra `http://127.0.0.1:8080`.

Os dois comandos sobem o Vite no `8080` e uma API local no `3000`, sem usar a API antiga publicada na Vercel. `npm run dev` mantém o `N8N_WEBHOOK_BASE_URL`; `npm run dev:local` chama a Proxis diretamente.

Para executar somente o Vite e encaminhar `/api` para o ambiente publicado, use `npm run dev:remote`.

Gere a versao de producao com:

```bash
npm run build
```

Rode a verificacao de qualidade com:

```bash
npm run lint
npm run test
```

## Observacoes de estrutura
- O `index.html` e parte central da entrada do Vite.
- A documentacao detalhada do projeto fica em `documentation/`, mas essa pasta e local e nao entra no Git.
- Os arquivos de apoio de dados usados por scripts ficam em `scripts/data/`.
- Os tipos do Supabase devem ser mantidos sincronizados com o schema do banco.
