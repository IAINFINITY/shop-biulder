# Clinic+ B2B

Projeto de catalogo, carrinho e pedido para a Clinic+, construido com Vite, React e TypeScript.

## Visao geral
- Catalogo publico com busca, filtros e detalhes do produto
- Carrinho de interesse com observacoes por item
- Formulario de pedido com validacoes de cliente e endereco
- Area de login, conta e admin
- Integracao com Supabase para dados, auth, storage e tipos
- Integracao serverless com Proxis em `api/proxis-order.ts`

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

## Dependencias e comandos
Instale as dependencias com:

```bash
npm install
```

Inicie o desenvolvimento com:

```bash
npm run dev
```

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
