-- Aviso de imagem nova.
--
-- ## Por que ficou numa migration separada
--
-- Imagem não é uma tabela nossa: ela é um objeto em `storage.objects`, que
-- pertence ao `supabase_storage_admin`. Conferido em 31/08/2026 que dá para
-- criar o gatilho — mas **é um gatilho em tabela de sistema**, e essa diferença
-- merece um arquivo próprio: se um dia o Supabase mudar a permissão, é este
-- arquivo que para de aplicar, e não o dos avisos inteiros.
--
-- ## Só os buckets do painel
--
-- `storage.objects` recebe **tudo**, de qualquer bucket. Hoje só existe o
-- `product-images` (conferido em 31/08/2026) — e é justamente por isso que o
-- filtro fica: no dia em que alguém criar um bucket de anexo ou de temporários,
-- o sino não passa a tocar sozinho por upload que ninguém fez, que é o jeito
-- mais rápido de ensinar a equipe a ignorá-lo.

create or replace function public.aviso_de_imagem_nova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bucket_id <> 'product-images' then
    return new;
  end if;

  perform public.registrar_aviso_do_painel(
    'imagem_nova',
    'Nova imagem enviada',
    -- Só o nome do arquivo: o caminho inteiro não cabe na linha do sino e não
    -- diz mais nada a quem lê.
    regexp_replace(coalesce(new.name, ''), '^.*/', ''),
    'imagens',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists aviso_de_imagem_nova on storage.objects;
create trigger aviso_de_imagem_nova
  after insert on storage.objects
  for each row execute function public.aviso_de_imagem_nova();
