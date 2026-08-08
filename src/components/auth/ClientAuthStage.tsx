import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ClientAuthStageProps = {
  children: ReactNode;
  className?: string;
};

/**
 * O palco das telas de autenticacao: uma coluna, centralizada.
 *
 * ## O que saiu daqui, e por que
 *
 * Havia uma coluna lateral ocupando 58% da largura, com titulo grande, um
 * paragrafo e quatro cartoes de destaque ("Compra guiada", "Cadastro B2B",
 * "Precos por perfil", "Pedido rapido").
 *
 * Medido em 08/08, com as paginas de login reais abertas lado a lado:
 *
 *   Shopify 10 palavras · Netshoes 15 · Mercado Livre 21 · Amazon 25
 *   Magazine Luiza 28 · Stripe 63  ·  **a nossa: 101**
 *
 * E o formulario ficava em x=1011 de 1280 — empurrado para a direita pelo
 * painel, em vez de no eixo onde o olho procura.
 *
 * O argumento contra remover seria "aproveitar a tela para vender". Mas quem
 * chega aqui ja decidiu entrar; nao e publico a convencer, e sim cliente a
 * atender. Texto que nao ajuda a digitar e-mail e senha atrapalha.
 *
 * ## O celular ja estava certo
 *
 * A coluna lateral so existia a partir de `lg`, entao no telefone a tela ja era
 * uma coluna centralizada com 33 palavras. A mudanca **nao altera o celular** —
 * ela leva o desktop para onde o celular ja estava.
 */
export function ClientAuthStage({ children, className }: ClientAuthStageProps) {
  return (
    <div
      className={cn(
        // Quem rola e a **pagina**, e nao uma caixa por dentro. Ver o historico
        // no comentario do `PublicLayout`: com altura definida e `overflow`
        // escondido, o cadastro (7 campos, ~1136px) nao cabia em ~700px de area
        // util e rolava dentro de um cartao arredondado.
        "relative flex min-h-[calc(100dvh-var(--page-header-shell-height,0px))] justify-center bg-background text-foreground",
        className,
      )}
    >
      <section className="flex w-full items-start justify-center px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0rem)+0.75rem)] pt-8 sm:px-6 sm:pt-12 lg:pb-16 lg:pt-16">
        {/* 480px e a faixa que a pesquisa de formularios aponta para coluna
            unica no desktop (400–500px). */}
        <div className="flex w-full max-w-[480px] flex-col">{children}</div>
      </section>
    </div>
  );
}
