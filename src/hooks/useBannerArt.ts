import { useMemo } from "react";
import { useCatalogBanners } from "@/hooks/useCatalogBanners";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { podeVer } from "@/lib/visibilidade";

/**
 * Artes ativas de uma area do site, na ordem em que devem aparecer.
 *
 * Devolve lista, e nao uma arte so, porque o trio mostra tres quadros e o par
 * mostra dois. Quem chama corta no tamanho do proprio bloco e completa o que
 * faltar com o exemplo — assim uma area meio preenchida continua com o desenho
 * certo em vez de abrir buraco na pagina.
 *
 * O recorte por tipo de cliente e o mesmo do banner do topo: sem `visible_to` a
 * arte vale para todo mundo; com ele, so para quem esta na lista. Sem isso uma
 * campanha restrita a um tipo de cliente vazaria para os demais.
 *
 * Devolve as duas artes, e nao so a de desktop. `image_url_mobile` era
 * descartado aqui, entao trio, par, destaque e faixa ignoravam a arte de celular
 * mesmo quando ela existia no cadastro — e a faixa, a 5:1, ficava com 78px de
 * altura num celular de 390px. Uma tarja, nao um banner.
 */
export type ArteDeBanner = {
  /** Destino cru do cadastro; quem resolve e `resolverLinkDeBanner`. */
  link: string | null;
  desktop: string;
  /** Nulo = usa a de desktop, cortada no centro. */
  celular: string | null;
};

export function useBannerArtBySlot(slot: string, customerType: string | null): {
  artes: ArteDeBanner[];
  /**
   * `true` enquanto o fetch dos banners ainda roda. Quem desenha o quadro deve
   * usar isso para nao piscar o placeholder "arte aqui": com `initialData: []`
   * o `data` chega vazio antes do servidor responder, e sem o sinal de loading
   * a vitrine mostrava o texto por um instante mesmo tendo arte cadastrada.
   */
  loading: boolean;
} {
  const { data: banners = [], isFetching } = useCatalogBanners({ activeOnly: true });
  const { isAdmin } = useAuth();
  const { options: tiposDeCliente } = useCustomerTypes();
  const todosOsTipos = useMemo(() => tiposDeCliente.map((tipo) => tipo.name), [tiposDeCliente]);

  const artes = useMemo(() => {
    return banners
      .filter((banner) => banner.slot === slot)
      .filter((banner) => podeVer(banner, { customerType, todosOsTipos, isAdmin }))
      .filter((banner) => banner.image_url.trim() !== "")
      .sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at))
      .map((banner) => ({
        // O link vinha sendo descartado aqui: os slots par/trio/unico tinham
        // a prop `href` mas nada a alimentava, entao clicar no banner nao fazia
        // nada.
        link: banner.link_url ?? null,
        desktop: banner.image_url,
        celular: banner.image_url_mobile?.trim() || null,
      }));
  }, [banners, slot, customerType, todosOsTipos, isAdmin]);

  return { artes, loading: isFetching };
}
