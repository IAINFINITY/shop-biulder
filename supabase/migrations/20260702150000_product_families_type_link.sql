ALTER TABLE public.product_families
ADD COLUMN IF NOT EXISTS type_id uuid;

WITH family_type_counts AS (
  SELECT
    trim(family) AS family_name,
    trim(type) AS type_name,
    count(*) AS product_count,
    row_number() OVER (
      PARTITION BY trim(family)
      ORDER BY count(*) DESC, trim(type) ASC
    ) AS rn
  FROM public."Clinic+ - Catálogo Front B2B"
  WHERE trim(coalesce(family, '')) <> ''
    AND trim(coalesce(type, '')) <> ''
  GROUP BY trim(family), trim(type)
),
canonical_family_type AS (
  SELECT family_name, type_name
  FROM family_type_counts
  WHERE rn = 1
)
UPDATE public.product_families pf
SET type_id = pt.id
FROM canonical_family_type cft
JOIN public.product_types pt
  ON trim(pt.name) = cft.type_name
WHERE trim(pf.name) = cft.family_name;

ALTER TABLE public.product_families
DROP CONSTRAINT IF EXISTS product_families_name_key;

INSERT INTO public.product_families (name, type_id)
SELECT DISTINCT
  trim(p.family) AS family_name,
  pt.id AS type_id
FROM public."Clinic+ - Catálogo Front B2B" p
JOIN public.product_types pt
  ON trim(pt.name) = trim(p.type)
WHERE trim(coalesce(p.family, '')) <> ''
  AND trim(coalesce(p.type, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_families pf
    WHERE pf.name = trim(p.family)
      AND pf.type_id = pt.id
  );

ALTER TABLE public.product_families
ALTER COLUMN type_id SET NOT NULL;

ALTER TABLE public.product_families
ADD CONSTRAINT product_families_type_id_fkey
FOREIGN KEY (type_id) REFERENCES public.product_types(id) ON DELETE CASCADE;

ALTER TABLE public.product_families
ADD CONSTRAINT product_families_type_id_name_key UNIQUE (type_id, name);

CREATE INDEX IF NOT EXISTS product_families_type_id_idx
ON public.product_families (type_id);
