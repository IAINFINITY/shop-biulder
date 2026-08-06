-- Produto em mais de uma subcategoria.
--
-- Ate aqui `family` era uma coluna de texto unico: um produto pertencia a uma
-- subcategoria e ponto. O time de design precisa marcar mais de uma.
--
-- **Adicao, e nao renomeacao.** Levantei os 58 usos de `family` no codigo: 48
-- apenas leem ou repassam um valor unico — exibicao, linha do pedido, payload do
-- ERP, previa do admin. So 10 decidem pertencimento (arvore de filtros do
-- catalogo, filtro do admin, relacionados).
--
-- Converter a coluna para array obrigaria a tocar nos 48, incluindo o caminho do
-- pedido, que grava historico e conversa com o Proxis. Manter `family` como a
-- subcategoria **principal** e adicionar `families` para o pertencimento deixa
-- esses 48 intactos e reversivel: se algo der errado, basta parar de ler
-- `families`.

alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  add column if not exists families text[];

-- Backfill: quem tinha uma subcategoria passa a ter uma lista de um item.
--
-- `nullif` protege do produto com `family` em branco, que viraria uma lista
-- contendo string vazia — e string vazia apareceria como subcategoria fantasma
-- na arvore de filtros.
update public."clinic+b2b_clinic_catalogo_front_b2b"
set families = array[trim(family)]
where families is null
  and nullif(trim(coalesce(family, '')), '') is not null;

-- Produto sem subcategoria nenhuma fica com lista vazia, e nao nula: assim o
-- codigo le sempre um array e nao precisa de guarda em cada ponto.
update public."clinic+b2b_clinic_catalogo_front_b2b"
set families = '{}'::text[]
where families is null;

alter table public."clinic+b2b_clinic_catalogo_front_b2b"
  alter column families set default '{}'::text[];

-- A arvore de filtros consulta por pertencimento.
create index if not exists clinic_b2b_produto_families_idx
  on public."clinic+b2b_clinic_catalogo_front_b2b" using gin (families);

comment on column public."clinic+b2b_clinic_catalogo_front_b2b".family is
  'Subcategoria principal — a primeira de families. Usada em exibicao, pedido e ERP.';
comment on column public."clinic+b2b_clinic_catalogo_front_b2b".families is
  'Todas as subcategorias do produto. Manda no filtro e na arvore de categorias.';
