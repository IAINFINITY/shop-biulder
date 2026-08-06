import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Clock3, ShoppingCart, Tag } from "lucide-react";

type ClientAuthHighlight = {
  title: string;
  text: string;
};

type ClientAuthStageProps = {
  children: ReactNode;
  className?: string;
};

const highlights: ClientAuthHighlight[] = [
  {
    title: "Compra guiada",
    text: "Login libera a experiência completa com preços e pedidos.",
  },
  {
    title: "Cadastro B2B",
    text: "CNPJ e empresa organizam o atendimento do cliente.",
  },
  {
    title: "Preços por perfil",
    text: "A conta abre a tabela certa para seu perfil.",
  },
  {
    title: "Pedido rápido",
    text: "Fluxo direto com dados do cliente já preenchidos.",
  },
];

const highlightIcons = [ClipboardCheck, ShoppingCart, Clock3, Tag];

export function ClientAuthStage({ children, className }: ClientAuthStageProps) {
  return (
    <div
      className={cn(
        // Altura do que **sobra**, e nao da tela inteira.
        //
        // Este bloco nasceu dono da tela: `h-[100dvh]` aqui e, dentro,
        // `calc(100dvh - altura do cabecalho)`. Duas caixas de tela cheia
        // aninhadas so nao estouravam porque nao havia cabecalho nenhum acima.
        // Com o cabecalho da loja no lugar, a externa sobrava inteira — era o
        // retangulo branco embaixo do formulario.
        //
        // **Sem altura minima no celular.** O layout dividido so existe a partir
        // de `lg` — ali a coluna lateral precisa de altura para preencher. No
        // celular ha so o formulario, e forcar altura de tela sobrava como
        // retangulo vazio embaixo dele: medido, 152px depois do ultimo texto.
        // Altura **definida**, e nao minima.
        //
        // A `<section>` de baixo e `overflow-y-auto`: o desenho e o formulario
        // rolar por dentro dela, com a pagina parada. Isso exige que este bloco
        // tenha altura, senao ele cresce com o conteudo e quem rola passa a ser
        // o documento — sobrando uma faixa branca depois do cartao.
        //
        // O `calc` desconta o cabecalho da loja, que agora fica acima. Antes o
        // valor era `100dvh` cravado, de quando esta tela nao tinha cabecalho.
        "relative h-[calc(100dvh-var(--page-header-shell-height,0px))] overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {/* Sem cabecalho proprio.

          Este bloco montava um `PageHeaderShell` so dele, com o logo e um link
          de texto "Voltar ao catalogo" — enquanto o resto do site usa o
          cabecalho da loja. Duas barras diferentes para a mesma funcao, e nesta
          o carrinho e a busca simplesmente nao existiam.

          Agora quem desenha o topo e o `PublicLayout`, igual em qualquer outra
          pagina. O `calc` abaixo continua valendo: e ele que le a altura do
          cabecalho, e sempre foi escrito supondo que houvesse um. */}
      <div className="grid h-full w-full grid-cols-1 overflow-hidden pt-6 lg:grid-cols-[58%_42%] lg:pt-8">
        <div className="pointer-events-none absolute inset-y-0 left-[58%] hidden w-px bg-border/70 lg:block" />
        <aside className="relative hidden overflow-y-auto bg-background lg:flex">
          <div className="relative z-10 flex h-full w-full flex-col justify-center px-12 py-10 xl:px-[72px] xl:py-12">
            <div className="w-full max-w-[900px]">
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
                Área do cliente B2B
              </p>
              <h1 className="max-w-[14ch] text-[clamp(2.4rem,4vw,3.8rem)] font-semibold leading-[1.04] tracking-tight text-foreground">
                Acesse sua conta
                <br />
                no Clinic+
              </h1>
              <p className="mt-3 max-w-[66ch] text-sm leading-6 text-muted-foreground">
                Entre para ver preços por perfil, pedidos e a experiência completa da sua empresa. Ou crie sua conta para começar.
              </p>
            </div>

            <div className="mt-8 grid w-full max-w-[920px] grid-cols-2 gap-4">
              {highlights.map((item, index) => {
                const Icon = highlightIcons[index % highlightIcons.length];
                return (
                  <div
                    key={item.title}
                    className="rounded-[1.1rem] border border-border/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)]"
                  >
                    <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium leading-5 text-foreground">{item.title}</p>
                    <p className="mt-2 text-[0.8125rem] leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* `pb-12` so no desktop. No celular o `<main>` do PublicLayout ja
            acrescenta `pb-16` para a barra inferior, e os dois somados deixavam
            uma faixa branca visivel entre o fim do cartao e a barra. */}
        <section className="flex h-full min-h-0 items-start justify-center overflow-y-auto bg-background px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0rem)+0.75rem)] pt-6 sm:px-6 sm:pt-10 lg:pb-12 lg:px-10 lg:pt-12 xl:px-[72px]">
          {/* `h-full` aqui tambem, e nao so em `lg`.

            Este div fica entre a `<section>` (que tem altura) e o cartao (que
            pede `h-full`). Sendo de altura automatica, ele quebrava a cadeia:
            `height:100%` no cartao nao tinha contra o que resolver e o cartao
            crescia com o conteudo, passando por baixo da barra de navegacao.
            Com altura aqui, o cartao fica do tamanho da area e quem rola e o
            corpo dele, por dentro. */}
          <div className="flex h-full w-full max-w-[560px] flex-col justify-start min-[900px]:py-4 lg:min-h-full">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

