# Contexto

## 1. Resumo do projeto
`Catalogo Clinic+` é um catálogo B2B com carrinho, checkout, avaliações, favoritos e painel administrativo.
O foco do produto é facilitar a busca de produtos, o envio do pedido e a manutenção do catálogo sem deixar o fluxo pesado.

## 2. O que o produto faz hoje
- Mostra um catálogo público com busca, filtros por tipo e família integrados ao header
- Header + navegação de categorias grudam no topo ao scrollar (estilo ClinicMais original)
- Abre a página de detalhes do produto com galeria de imagens, zoom/lente, breadcrumbs, selos de confiança e seletor de quantidade
- Sistema completo de avaliações com estrelas, comentários, tags, resposta do admin e paginação
- Lista de desejos/favoritos com persistência local
- Vistos recentemente com carrossel
- Quick View para inspeção rápida do produto sem sair do catálogo
- Mantém carrinho com quantidade, observações, subtotal e acesso ao checkout
- Salva pedidos no Supabase
- Envia o pedido para o Proxsys por meio da rota de API
- Oferece login com animação slide entre abas, conta do cliente e área administrativa
- Permite criar, editar, ocultar, excluir e categorizar produtos
- Guarda imagens de produto no Supabase Storage (normalização automática para WebP 1200×900)
- Banners do catálogo gerenciáveis pelo admin com autoplay e dots
- Footer profissional com logo, links, contato, redes sociais e formas de pagamento
- CEP na navbar com consulta ViaCEP
- Fonte Inter como tipografia principal
- Suporte ao cliente via WhatsApp integrado

## 3. Stack atual
- React
- Vite
- TypeScript
- Tailwind CSS
- componentes no estilo shadcn/ui
- React Router
- TanStack React Query
- Supabase
- API serverless em `api/proxis-order.ts`
- n8n para apoio a integrações e testes de fluxo
- Embla Carousel (shadcn Carousel)
- Sonner (toast notifications)

## 4. Fluxo principal
1. O cliente abre o catálogo
2. O cliente busca ou filtra produtos pelas categorias no header
3. O cliente adiciona itens ao carrinho ou aos favoritos
4. O cliente revisa o carrinho ou o formulário do pedido
5. O pedido é salvo no Supabase
6. O pedido é enviado ao Proxsys quando a integração responde
7. O cliente vai para a tela de sucesso

## 5. Áreas principais do código
- `src/pages` para telas de rota
- `src/components` para blocos reutilizáveis e componentes de domínio
  - `catalogo/` — StoreHeader, StoreHeroBanner, CategoryTopNav, CatalogProductCard, CatalogThemeSections, CatalogFiltersBarStickyFilters, QuickView, StarRating, CepLocationButton, ProductDescription
  - `carrinho/` — CartDrawer, CartTotalBar
  - `pedido/` — CustomerDataFields, AddressFields
  - `admin/` — componentes do workspace administrativo
  - `auth/` — ClientAuthStage, AdminAuthStage, AuthStatusScreen
  - `client/` — componentes da área do cliente
  - `layout/` — PageHeaderShell, StoreFooter
  - `mobile/` — MobileBottomNav, StickyBottomCTA, TouchCarousel
  - `shared/` — ClinicPlusLogo, ConfirmActionDialog
  - `support/` — SupportChatPanel
  - `ui/` — primitivas visuais (shadcn/ui)
- `src/hooks` para acesso a dados e comportamento
- `src/lib` para regras de negócio, formatação e helpers
- `src/integrations/supabase` para cliente e tipos gerados
- `api` para endpoints de integração
- `supabase` para migrações, SQL, seed e config
- `n8n` para arquivos de workflows
- `scripts` para rotinas de manutenção

## 6. Regras do produto
- Manter o catálogo simples e rápido de usar
- Manter os campos do pedido claros e objetivos
- Manter o admin prático e compacto
- Manter consistência entre front, API e Supabase
- Evitar mover regra de negócio para as páginas quando ela pertence a `src/lib`
- Imagens de produto são normalizadas para WebP 1200×900 (4:3) com fundo branco
- Banners devem usar URL direta para evitar o pipeline de normalização de produto
- Cache CDN de imagens: 1 ano

## 7. Arquivos que definem o comportamento atual
- `src/App.tsx`
- `src/pages/Index.tsx`
- `src/pages/ProductDetails.tsx`
- `src/pages/OrderForm.tsx`
- `src/pages/AdminWorkspace.tsx`
- `src/pages/Account.tsx`
- `src/pages/Login.tsx`
- `src/components/catalogo/StoreHeader.tsx`
- `src/components/catalogo/CatalogProductCard.tsx`
- `src/components/catalogo/CategoryTopNav.tsx`
- `src/components/catalogo/CatalogFiltersBarStickyFilters.tsx`
- `src/components/catalogo/StarRating.tsx`
- `src/components/catalogo/QuickView.tsx`
- `src/components/layout/StoreFooter.tsx`
- `src/components/carrinho/CartDrawer.tsx`
- `src/hooks/useProductReviews.ts`
- `src/hooks/useWishlist.ts`
- `src/hooks/useRecentlyViewed.ts`
- `src/hooks/useDeliveryCep.ts`
- `src/lib/products.ts`
- `src/lib/orders.ts`
- `src/lib/pricing.ts`
- `api/proxis-order.ts`

## 8. Como usar esta documentação
- Tratar esta pasta como referência para decisões do projeto
- Atualizar os docs quando o fluxo do produto mudar
- Manter o padrão visual alinhado com o Clinic+ atual
- Preferir ajustes pequenos e progressivos em vez de reescrever tudo de uma vez
