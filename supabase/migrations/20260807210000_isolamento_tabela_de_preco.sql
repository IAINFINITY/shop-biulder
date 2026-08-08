-- Cada cliente enxerga só a própria tabela de preço.
--
-- ## O furo
--
-- A política de leitura era esta:
--
--   (active IS TRUE) AND (
--     clinic_b2b_is_internal_staff()
--     OR EXISTS (SELECT 1 FROM "clinic+b2b_customer_profiles" cp
--                WHERE cp.user_id = auth.uid())
--   )
--
-- O `EXISTS` **não correlaciona nada**. Ele pergunta apenas "quem está chamando
-- tem algum perfil de cliente?" — e não "esta linha pertence a quem está
-- chamando?". A subconsulta nem referencia a linha externa.
--
-- Efeito: qualquer cliente autenticado lê as **570 linhas ativas**, que são as
-- 4 tabelas de preço negociadas:
--
--   por TPR 8728  138 linhas   R$   2,81 – 193,69
--   por TPR 8729  132 linhas   R$   1,83 – 225,92
--   por TPR 8744  148 linhas   R$   2,39 – 339,61
--   por TPR 8745  149 linhas   R$   2,39 – 339,61
--   por tipo        3 linhas
--
-- Um distribuidor lê a tabela do lojista; um lojista lê a do distribuidor. É o
-- dado comercialmente mais sensível do sistema, e é exatamente o vazamento
-- cross-tenant que o Perfil C da §5 existe para impedir. A §16 é explícita:
-- "a decisão DEVE considerar ação, função, objeto, campo, tenant, propriedade".
--
-- ## A correção
--
-- Correlacionar a linha com o perfil de quem chama:
--
--   - linha COM `proxis_tpr_id` → só quem aponta para aquela mesma TPR;
--   - linha SEM `proxis_tpr_id` → só quem tem aquele mesmo `customer_type`.
--
-- É a mesma divisão que `useCustomerPricing` já faz no cliente: a camada geral
-- vem por `customer_type` com `proxis_tpr_id is null`, e a camada de cima por
-- `proxis_tpr_id`. Ou seja, **a loja não muda de comportamento** — ela já pedia
-- exatamente estas linhas. O que muda é quem pede sem os filtros.
--
-- ## Admin não passa por aqui
--
-- A política `Clinic B2B internal read price overrides` continua existindo, com
-- `clinic_b2b_is_internal_staff()`. Políticas do mesmo comando se somam por OR,
-- então o painel segue lendo tudo — inclusive linhas inativas, que esta aqui nem
-- considera.

drop policy if exists "Clinic B2B customers can read active price overrides"
  on "clinic+b2b_customer_price_overrides";

create policy "Clinic B2B customers can read active price overrides"
  on "clinic+b2b_customer_price_overrides" for select
  to authenticated
  using (
    active is true
    and exists (
      select 1
      from "clinic+b2b_customer_profiles" cp
      where cp.user_id = auth.uid()
        and (
          -- Camada do cliente: a tabela do Proxis, identificada pela TPR.
          (
            "clinic+b2b_customer_price_overrides".proxis_tpr_id is not null
            and cp.proxis_tpr_id = "clinic+b2b_customer_price_overrides".proxis_tpr_id
          )
          -- Camada geral: o preço do tipo de cliente, sem TPR.
          or (
            "clinic+b2b_customer_price_overrides".proxis_tpr_id is null
            and lower(btrim(coalesce(cp.customer_type, ''))) =
                lower(btrim(coalesce("clinic+b2b_customer_price_overrides".customer_type, '')))
            and coalesce(cp.customer_type, '') <> ''
          )
        )
    )
  );

comment on table "clinic+b2b_customer_price_overrides" is
  'Preços negociados. Leitura de cliente é isolada por proxis_tpr_id (camada do cliente) ou customer_type (camada geral). Admin lê tudo pela política interna. Ver §16 do padrão de autenticação.';
