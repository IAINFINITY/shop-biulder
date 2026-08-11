import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductImageCarouselEditor } from "@/components/admin/ProductImageCarouselEditor";

/**
 * Reordenar as fotos sem apagar e subir de novo.
 *
 * Quem administra a loja relatou que só sabia trocar a ordem apagando a foto e
 * carregando outra vez. As setas já existiam; o arrasto foi acrescentado depois.
 * Este arquivo existe porque nenhuma das duas coisas tinha teste — o arrasto
 * chegou a ser escrito e publicado sem nunca ter sido executado.
 */

const URLS = ["https://x/capa.webp", "https://x/foto2.webp", "https://x/foto3.webp"];

function renderizar(sobrescreve: Partial<Parameters<typeof ProductImageCarouselEditor>[0]> = {}) {
  const onMoveAt = vi.fn();
  render(
    <ProductImageCarouselEditor
      urls={URLS}
      alts={["capa", "segunda", "terceira"]}
      imageFit="contain"
      uploading={false}
      fileInputRef={createRef<HTMLInputElement>()}
      onFileChange={vi.fn()}
      onRemoveAt={vi.fn()}
      onMoveAt={onMoveAt}
      onAltChange={vi.fn()}
      onImageFitChange={vi.fn()}
      {...sobrescreve}
    />,
  );
  return { onMoveAt };
}

/** O cartão da miniatura, achado pelo campo de descrição que ele contém. */
function cartao(indice: number): HTMLElement {
  const input = screen.getByLabelText(`Descrição da foto ${indice + 1}`);
  const alvo = input.closest("div.w-\\[9\\.5rem\\]");
  if (!alvo) throw new Error(`não achei o cartão da foto ${indice + 1}`);
  return alvo as HTMLElement;
}

/** Um `dataTransfer` de mentira — o jsdom não fornece um. */
function dataTransfer() {
  const dados = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (tipo: string, valor: string) => dados.set(tipo, valor),
    getData: (tipo: string) => dados.get(tipo) ?? "",
    setDragImage: () => {},
  };
}

describe("reordenar fotos por arrasto", () => {
  it("arrastar a terceira sobre a primeira pede a troca certa", () => {
    const { onMoveAt } = renderizar();
    const dt = dataTransfer();

    const origem = within(cartao(2)).getByText("Foto 3").parentElement!;
    fireEvent.dragStart(origem, { dataTransfer: dt });
    fireEvent.dragOver(cartao(0), { dataTransfer: dt });
    fireEvent.drop(cartao(0), { dataTransfer: dt });

    expect(onMoveAt).toHaveBeenCalledWith(2, 0);
  });

  it("marca o cartão como destino válido enquanto algo é arrastado", () => {
    /**
     * O teste que faltava, e o mais importante de todos.
     *
     * A especificação de arrastar-e-soltar diz que uma área **só** aceita
     * soltura se o `dragover` for cancelado com `preventDefault()`. Sem isso o
     * navegador recusa o destino e o `drop` nunca dispara — o arrasto não faz
     * nada, sem erro nenhum no console.
     *
     * O jsdom não implementa essa regra: ele entrega o `drop` de qualquer
     * jeito. Verifiquei removendo o `preventDefault` do componente — os outros
     * testes continuaram todos verdes, com o recurso quebrado num navegador de
     * verdade. Por isso a asserção aqui é sobre o cancelamento em si:
     * `fireEvent` devolve `false` quando algum handler chamou `preventDefault`,
     * que é exatamente o contrato que o navegador exige.
     */
    renderizar();
    const dt = dataTransfer();

    const origem = within(cartao(2)).getByText("Foto 3").parentElement!;
    fireEvent.dragStart(origem, { dataTransfer: dt });

    const naoFoiCancelado = fireEvent.dragOver(cartao(0), { dataTransfer: dt });
    expect(naoFoiCancelado, "o dragover precisa ser cancelado para o drop existir").toBe(false);
  });

  it("não sequestra o arrasto quando não há nada sendo movido", () => {
    // O outro lado da moeda: arrastar um arquivo do computador para a página
    // não pode ser cancelado por nós, senão a área passaria a se anunciar como
    // destino de uma soltura que ela não sabe tratar.
    renderizar();
    const naoFoiCancelado = fireEvent.dragOver(cartao(0), { dataTransfer: dataTransfer() });
    expect(naoFoiCancelado).toBe(true);
  });

  it("soltar no próprio lugar não mexe em nada", () => {
    // Sem isto, um clique que o navegador interpreta como arrasto curtíssimo
    // dispararia uma reordenação inútil — e o salvamento renomearia arquivos
    // no storage à toa.
    const { onMoveAt } = renderizar();
    const dt = dataTransfer();

    const origem = within(cartao(1)).getByText("Foto 2").parentElement!;
    fireEvent.dragStart(origem, { dataTransfer: dt });
    fireEvent.drop(cartao(1), { dataTransfer: dt });

    expect(onMoveAt).not.toHaveBeenCalled();
  });

  it("soltar sem ter arrastado nada é ignorado", () => {
    // Arrastar um arquivo do computador para cima da lista cai aqui.
    const { onMoveAt } = renderizar();
    fireEvent.drop(cartao(0), { dataTransfer: dataTransfer() });
    expect(onMoveAt).not.toHaveBeenCalled();
  });

  it("com uma foto só o arrasto fica desligado", () => {
    renderizar({ urls: [URLS[0]], alts: ["capa"] });
    const area = within(cartao(0)).getByText("Capa").parentElement!;
    expect(area).not.toHaveAttribute("draggable", "true");
  });

  it("durante um envio o arrasto fica desligado", () => {
    // Reordenar no meio de um upload mudaria a lista sob os pés de quem está
    // gravando — a foto nova entra no fim, e o fim já teria mudado de lugar.
    renderizar({ uploading: true });
    const area = within(cartao(0)).getByText("Capa").parentElement!;
    expect(area).not.toHaveAttribute("draggable", "true");
  });
});

describe("reordenar fotos pelas setas", () => {
  it("a seta da esquerda da segunda foto a torna capa", () => {
    const { onMoveAt } = renderizar();
    fireEvent.click(screen.getByLabelText("Tornar esta foto a capa"));
    expect(onMoveAt).toHaveBeenCalledWith(1, 0);
  });

  it("a seta da direita empurra para a posição seguinte", () => {
    const { onMoveAt } = renderizar();
    fireEvent.click(screen.getByLabelText("Mover a foto 1 para a posição 2"));
    expect(onMoveAt).toHaveBeenCalledWith(0, 1);
  });

  it("a capa não tem para onde ir à esquerda, nem a última à direita", () => {
    renderizar();
    // A capa é a foto 1: não existe seta para a esquerda habilitada nela.
    expect(screen.getByLabelText("Mover a foto 3 para a posição 4")).toBeDisabled();
  });
});
