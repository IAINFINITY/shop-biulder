create or replace function public.block_zero_price_active_products()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.active, false) and coalesce(new.price, 0) <= 0 then
    raise exception 'O produto precisa ter preço maior que zero para ficar ativo.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_zero_price_active_products on public."Clinic+ - Catálogo Front B2B";

create trigger trg_block_zero_price_active_products
before insert or update of active, price on public."Clinic+ - Catálogo Front B2B"
for each row
execute function public.block_zero_price_active_products();
