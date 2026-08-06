import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Um filtro do catalogo, guardado **na URL** e em nenhum outro lugar.
 *
 * A versao anterior mantinha os filtros em `useState` e copiava para a URL com
 * efeitos. Isso e estado duplicado, e dois efeitos escrevendo um no outro sempre
 * terao corrida: clicar num banner que aponta para `/?categoria=Whey` gerava 58
 * trocas de endereco em segundos, com a tela piscando.
 *
 * Aqui nao ha copia nem efeito. O valor e **derivado** de `searchParams` durante
 * a renderizacao, e escrever significa trocar a URL. Sem segunda fonte, nao ha o
 * que divergir — o laco deixa de ser possivel por construcao, e nao por cuidado.
 *
 * A assinatura imita `useState` de proposito: os 24 pontos do catalogo que ja
 * chamavam `setSelectedType` e companhia continuam iguais.
 */
export function useFiltroNaUrl(
  chave: string,
): [string | null, (valor: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const valor = searchParams.get(chave);

  const definir = useCallback(
    (proximo: string | null) => {
      setSearchParams(
        (atuais) => {
          const copia = new URLSearchParams(atuais);
          if (proximo && proximo.trim()) copia.set(chave, proximo);
          else copia.delete(chave);
          return copia;
        },
        // `replace` e nao `push`: cada clique num filtro criando entrada no
        // historico faria o botao "voltar" desfazer filtro por filtro em vez de
        // sair da pagina.
        { replace: true },
      );
    },
    [chave, setSearchParams],
  );

  return [valor, definir];
}

/** Mesma ideia para filtro de liga/desliga. */
export function useFiltroBooleanoNaUrl(chave: string): [boolean, (valor: boolean) => void] {
  const [bruto, definirBruto] = useFiltroNaUrl(chave);

  const definir = useCallback(
    (valor: boolean) => definirBruto(valor ? "1" : null),
    [definirBruto],
  );

  return [bruto === "1", definir];
}

/**
 * Filtro com valor padrao — o padrao nao aparece na URL.
 *
 * Sem isso, `?ordem=relevance` iria junto em todo link compartilhado sem dizer
 * nada: e o que ja acontece quando ninguem escolheu ordem nenhuma.
 */
export function useFiltroComPadraoNaUrl<T extends string>(
  chave: string,
  padrao: T,
  valido: (valor: string) => valor is T,
): [T, (valor: T) => void] {
  const [bruto, definirBruto] = useFiltroNaUrl(chave);

  const valor = useMemo<T>(() => (bruto && valido(bruto) ? bruto : padrao), [bruto, padrao, valido]);
  const definir = useCallback(
    (proximo: T) => definirBruto(proximo === padrao ? null : proximo),
    [definirBruto, padrao],
  );

  return [valor, definir];
}
