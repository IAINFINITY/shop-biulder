# Clinic+ B2B — Segurança das rotas `/api/*` e galeria de produtos

Registro do que foi corrigido, por quê, e o que ficou pendente.

**Base:** commit `e885676` (2026-08-04) + as alterações descritas aqui, ainda **não
commitadas**.
**Data:** 2026-08-05.

---

## Estado da verificação

| Verificação | Antes | Depois |
|---|---|---|
| `npm run build` | passa | passa |
| `npx tsc --noEmit -p tsconfig.app.json` | limpo | limpo |
| `tsc --strict` sobre `api/*.ts` | limpo | limpo |
| `npm run lint` | 0 erros, 10 warnings | 0 erros, 10 warnings |
| `npm run test` | 156 testes / 21 arquivos | **191 testes / 25 arquivos** |

Os 10 warnings de lint são pré-existentes (`react-hooks/exhaustive-deps` e
`react-refresh`), nenhum nos arquivos tocados.

---

## O que era o problema

Três falhas de segurança nas rotas serverless e um bug funcional na galeria de
imagens. Todas confirmadas por leitura do código neste commit, não herdadas de
análise antiga.

### 1. Nenhuma das 6 rotas `/api/*` validava autenticação

`bitrix-deal`, `proxis-customer`, `proxis-health`, `proxis-item-check`,
`proxis-order` e `proxis-price-tables` iam do `if (req.method !== "POST")` direto
para a lógica de negócio. Qualquer pessoa com a URL do site conseguia criar
pedido e cadastro de cliente no ERP de produção, e consultar qualquer CNPJ
recebendo razão social, nome e tabela de preço.

### 2. O preço do pedido vinha do cliente

`dit_vlr_unitario: item.unit_price || 0` gravava no ERP o valor que o navegador
mandou, sem conferência. Mesmo depois de exigir login, qualquer cliente
autenticado conseguiria lançar pedido com preço arbitrário.

### 3. Código de produto entrava cru no filtro do Proxsys

`item.ite_numero = '${numero}'` interpolava valor do corpo da requisição dentro
de aspas simples no header `X-ProManager-Busca-Filtro`. O impacto exato depende
do parser do ProManager — que é caixa-preta — mas entrada não confiável chegando
a uma linguagem de consulta é injeção pelo piso.

### 4. Foto duplicada na galeria do produto

Relato do usuário: *"quando seleciono uma do nosso servidor, entra outra
repetida."*

Em `resolveProductImageUrls`, a capa (coluna legada `image_url`) passava por
`normalizeStoragePublicUrl` — que reescreve o host para o projeto novo — e a
galeria (`image_urls`) não passava. O dedupe comparava string exata, então a
mesma foto entrava duas vezes:

```
0  https://NOVO.supabase.co/storage/v1/object/public/product-images/7912.webp
1  https://ANTIGO.supabase.co/storage/v1/object/public/product-images/7912.webp
```

Consequência direta da migração de banco: antes as duas colunas guardavam a mesma
string. Atingia produtos ainda não salvos depois da migração — ao salvar,
`image_url` é regravado como `urls[0]` e o par volta a bater, o que fazia o
problema parecer intermitente.

---

## O que foi feito

### Arquivos novos

| Arquivo | Papel |
|---|---|
| `src/lib/apiAuth.ts` | Regra de autorização, pura e testável: `parseBearerToken`, `canActForCnpj` |
| `api/_auth.ts` | I/O da autenticação: lê credencial do ambiente, valida o token no Supabase, expõe `requireAuth` |
| `src/lib/serverPricing.ts` | Regra de preço do servidor, pura: `buildServerPriceMap`, `diffPrices`, `isValidQuantity` |
| `api/_pricing.ts` | Consulta de preços no banco + a flag `PRICING_ENFORCE_SERVER_PRICE` |
| `src/lib/proxisFilter.ts` | Sanitização dos filtros: `safeItemNumber`, `safeNumericFilter`, `safeQuotedLiteral` |
| `src/lib/apiFetch.ts` | `fetch` do front que injeta o `Authorization` |

A divisão entre lógica pura em `src/lib` e I/O em `api/` segue o que
`proxisTpr.ts` e `proxisOrderStatusStore.ts` já faziam: é o que deixa a regra
testável sem subir servidor.

### Autenticação

Todas as 6 rotas começam com `const auth = await requireAuth(req, res); if
(!auth) return;`. `proxis-health`, `proxis-item-check` e `proxis-price-tables`
usam `{ adminOnly: true }` — só o painel as consome.

Autenticar sozinho não bastava: um cliente logado continuaria consultando a ficha
de qualquer CNPJ. Por isso `proxis-order`, `proxis-customer` e `bitrix-deal`
também checam `canActForCnpj`, que permite:

- **admin** → qualquer CNPJ (é ele quem reenvia pedido pelo painel);
- **cliente** → o próprio `cnpj`;
- **funcionário** → também o `linked_company_cnpj`, que é o caso de quem compra
  pelo CNPJ mestre da Clinic+.

`api/_auth.ts` fala com o Supabase por `fetch` na API REST em vez do SDK, como
`proxisOrderStatusStore` já fazia, para não carregar o pacote inteiro numa função
serverless. Erros de schema (`has_role` ausente, tabela renomeada) são logados
com `console.error` porque, em silêncio, virariam "não é admin" e "cliente sem
perfil" — ou seja, painel fora do ar e checkout em 403 sem explicação.

**No front:** todas as 10 chamadas a `/api/*` passaram a usar `apiFetch`. O
`local-api-server.mjs` libera `Authorization` no CORS, senão o preflight barra
tudo no dev local.

### Preço no servidor

`resolveServerPrices` refaz a conta a partir do banco, na mesma ordem do catálogo
do site: override da tabela do cliente (TPR) → override por tipo de cliente →
preço do catálogo. A tabela por TPR só entra se tiver alguma linha ativa, que é
exatamente a condição que `useCustomerPricing` usa — filtrar por código antes
dessa checagem mudaria o preço em casos de borda.

**Está em modo sombra.** Com `PRICING_ENFORCE_SERVER_PRICE` vazio, a rota calcula
o preço do servidor, registra as divergências com `console.warn` e envia o preço
do navegador. Para passar a valer: `PRICING_ENFORCE_SERVER_PRICE=1`.

A trava é deliberada: a regra tem casos de borda e um ERP de produção não é lugar
de descobrir divergência com pedido errado. **Confira os logs
`[proxis-order] Preço do navegador diferente do servidor` antes de ligar.**

`isValidQuantity` também passou a barrar quantidade não inteira, zero, negativa
ou acima de 9999 — antes entrava crua.

### Sanitização dos filtros

`safeItemNumber` usa allowlist (`^[A-Z0-9._/-]{1,40}$`) em vez de escape: o
parser do fornecedor é caixa-preta, e recusar o que não casa com o formato não
depende de adivinhar como ele trata aspas. Aplicado nos 7 pontos de interpolação
das rotas, incluindo os que já eram seguros por acidente — o risco real é alguém
adicionar um filtro novo amanhã e esquecer.

Em `proxis-item-check` o `code.replace(/'/g, "")` foi substituído pela allowlist.

### Galeria de imagens

`resolveProductImageUrls` normaliza os dois lados e deduplica pelo **caminho do
objeto no bucket** (`storageObjectKey`, novo em `storageUrls.ts`), não pela URL
crua. Assim host, query de cache e escape de caractere deixam de produzir falsos
distintos.

Corrigida também a regex de `parseSupabaseTextArray`, que tinha perdido os `?`:

```diff
- .split(/,(=(:(:[^"]*"){2})*[^"]*$)/)
+ .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
```

`(?=` tinha virado `(=` e `(?:` tinha virado `(:`. O padrão não separava mais o
literal `{url1,url2}` e, por ter virado grupo de captura, o `split` passaria a
injetar o que capturasse no meio do array. Não quebrava ainda porque o Supabase
devolve `image_urls` como array JSON e o early-return cobre o caso — era bomba
armada para o dia em que algum caminho recebesse o literal do Postgres.

### Testes adicionados (35 novos)

| Arquivo | Cobre |
|---|---|
| `src/lib/apiAuth.test.ts` | Quem pode agir por qual CNPJ, incluindo o caso do funcionário e do admin |
| `src/lib/proxisFilter.test.ts` | Allowlist aceitando código real e recusando tentativa de injeção |
| `src/lib/serverPricing.test.ts` | Precedência override/catálogo, descarte de preço zero, e um teste que trava o acordo com `buildCustomerPriceMap` do navegador |
| `src/lib/productImageGallery.test.ts` | Capa e galeria em hosts diferentes, query de cache, e o `split` sem grupo capturado |

---

## Antes de subir

**1. Front e API têm que ir no mesmo deploy.** A API sozinha derruba o checkout
com 401.

**2. Confirme as variáveis na Vercel.** `SUPABASE_SERVICE_ROLE_KEY` e
`SUPABASE_URL` (ou `VITE_SUPABASE_URL`) são obrigatórias agora — sem elas toda
rota responde 503. Documentadas em `.env.example`.

**3. Acompanhe o primeiro deploy** procurando por `[auth]` nos logs. Se algum
nome de tabela ou RPC tiver mudado no banco, é ali que aparece.

**4. Teste rápido do guard**, com `npm run dev:local` rodando:
```bash
curl -X POST http://127.0.0.1:3000/api/proxis-customer \
  -H "Content-Type: application/json" -d '{"cnpj":"04163851000106"}'
# esperado: 401 {"error":"Não autenticado."}
```

### Nomes de banco repetidos

`api/_auth.ts` e `api/_pricing.ts` declaram os nomes de tabela localmente em vez
de importar de `src/lib/customerProfile.ts` e `src/lib/products.ts`. Não é
descuido: aqueles arquivos importam o client do Supabase do navegador, e
importá-los arrastaria o SDK inteiro para dentro da função serverless. **Se um
nome mudar no banco, mude nos dois lugares.** Os valores atuais:

```
clinic+b2b_customer_profiles
clinic+b2b_customer_price_overrides
clinic+b2b_clinic_catalogo_front_b2b
```

---

## Pendente

### Fechar o diagnóstico da foto repetida

A correção resolve a duplicação da **capa**. No print que originou o chamado quem
repetia era Foto 3 e Foto 4 — ou há um segundo fator, ou são dois arquivos
distintos com o mesmo conteúdo (a mesma imagem enviada duas vezes; o código não
impede). Para fechar:

```sql
select product_code, image_url, image_urls
from "clinic+b2b_clinic_catalogo_front_b2b"
where product_code = '<código do pré-treino>';
```

### Ligar o preço do servidor

Depois de alguns dias de log sem divergência inesperada, `PRICING_ENFORCE_SERVER_PRICE=1`.

### Menores, sem urgência

| Item | Local | Observação |
|---|---|---|
| Rodízio de representante furado | `api/proxis-order.ts` (`representativeRotationIndex`) | Estado de módulo; em serverless cada instância fria reinicia no índice 0 e concentra pedidos nos primeiros representantes |
| PII em log | `api/proxis-order.ts` (`Buscando cliente por CNPJ`) | CNPJ do cliente em log de produção |
| Busca sequencial de produtos | `api/proxis-order.ts` (laço `for (const item of body.items)`) | Um `await` por item; carrinho de 20 itens = 20 round-trips em série |
| Arquivos grandes | `Account.tsx` 1227, `Index.tsx` 1116, `SupportChatPanel.tsx` 1105, `AdminWorkspace.tsx` ~1100 | — |

O bloco `let n8nProxy = ""` em `proxis-order.ts` **não** é pendência: tem
comentário e `eslint-disable` marcando que o caminho do proxy está desligado de
propósito enquanto a rota direta está em uso.

---

## Já resolvido pelo time — não reabrir

Itens de uma análise feita sobre commit antigo (`8eb0eef`) que o `e885676` já
tinha corrigido. Registrados para não voltarem à pauta:

- `src/integrations/supabase/types.ts` em UTF-16, que desligava o `tsc` do projeto
  inteiro → hoje é ASCII e o typecheck passa limpo
- 3 testes de `useAuth` quebrados (`useLocation` sem `<Router>`) → suíte verde
- `npm run lint` com 2 erros → 0 erros
- `AuthProvider` pulava o bootstrap quando `pathname === "/"`, e usuário logado
  aparecia deslogado em aba nova → o trecho não existe mais
- IDs mágicos `8278/8728/8729` espalhados → centralizados em `isB2bProxisTprId`
  (`src/lib/proxisTpr.ts`), com teste
- Ausência de migrations reais → `supabase/migrations/` tem histórico de verdade

---

## Nota de método

Toda a análise foi estática: leitura do repositório mais `build`, `lint`, `tsc` e
`test`. Nenhum acesso ao Supabase, à Proxsys, ao Bitrix ou ao ambiente publicado.
Nada aqui foi validado contra o ERP em execução.
