import heroGummiesBanner from "@/assets/hero-gummies-banner.png";

/** Painel promocional em largura total, abaixo do header. */
export function StoreHeroBanner() {
  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 border-b border-border/40 bg-muted/30"
      aria-label="Destaque promocional"
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-center px-0 sm:px-2">
        <img
          src={heroGummiesBanner}
          alt="Mais sabor, praticidade e inovação — linha de gomas Clinic+"
          className="block h-auto max-h-[min(42vw,420px)] w-full max-w-full object-contain object-center sm:max-h-[min(38vw,480px)]"
          width={1400}
          height={350}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </div>
    </section>
  );
}
