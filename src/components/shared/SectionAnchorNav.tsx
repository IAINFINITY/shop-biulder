import {useEffect, useState,  type MouseEvent} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegacao por ancoras com indicacao da secao visivel.
 *
 * Nasceu na Central de Ajuda e virou componente ao ser reaproveitada no
 * catalogo. O ganho e o mesmo nos dois lugares: paginas longas viram uma fila
 * continua de blocos, e sem um indice a pessoa nao sabe o que existe abaixo nem
 * onde esta.
 *
 * Segue a linguagem da antiga barra de categorias: faixa de largura total com
 * borda inferior, chips redondos e o ativo em primary.
 */
export type SectionAnchor = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export function SectionAnchorNav({
  sections,
  className,
}: {
  sections: readonly SectionAnchor[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  // A lista de secoes muda conforme filtros e conteudo (promocao pode nao
  // existir, favoritos podem estar vazios), entao o observer e refeito junto.
  const sectionKey = sections.map((section) => section.id).join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  /**
   * Rola suave e sem depender de hook externo.
   *
   * O salto nativo da ancora funciona, mas fica seco e o `scroll-mt` de cada
   * pagina precisaria bater certo. Tratando aqui, catalogo e central de ajuda
   * se comportam igual. O hash continua sendo escrito na URL para o link
   * permanecer compartilhavel.
   */
  const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(sectionId);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${sectionId}`);
    }
  };

  // Com uma secao so nao ha para onde navegar.
  if (sections.length <= 1) return null;

  return (
    <nav
      aria-label="Seções da página"
      // Faixa de ponta a ponta, como a barra do topo. Presa dentro do container
      // de conteudo ela terminava antes da borda e ficava desalinhada da topbar,
      // que e a barra logo acima dela.
      //
      // O vazamento e por margem negativa, e nao pelo `left-1/2` com
      // `-translate-x-1/2` que se costuma usar: aquele exige `position:relative`
      // e um `transform`, e os dois brigam com o `sticky` — a barra deixava de
      // acompanhar a rolagem. Com margem, `position` e `transform` ficam livres
      // e o comportamento fixo no topo continua intacto.
      className={cn(
        "sticky top-[var(--page-header-shell-height,88px)] z-20 border-b border-border/40 bg-card/95 backdrop-blur",
        "w-screen max-w-[100vw] ml-[calc(50%_-_50vw)]",
        className,
      )}
    >
      {/* Mesmo respiro lateral da barra do topo, para os itens comecarem na
          mesma coluna que o logo. */}
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(event) => handleAnchorClick(event, section.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "border border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
