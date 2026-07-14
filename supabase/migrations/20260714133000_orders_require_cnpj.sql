alter table public.orders
add constraint orders_customer_cnpj_must_have_14_digits
check (length(regexp_replace(customer_cnpj, '\D', '', 'g')) = 14) not valid;
