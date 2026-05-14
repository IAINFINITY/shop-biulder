-- Galeria de imagens por produto (URLs públicas do bucket product-images)
alter table public."Clinic+ - Catálogo Front B2B"
  add column if not exists image_urls text[] not null default '{}';

update public."Clinic+ - Catálogo Front B2B"
set image_urls = array[trim(both from image_url)]::text[]
where image_url is not null
  and trim(both from image_url) <> ''
  and coalesce(cardinality(image_urls), 0) = 0;
