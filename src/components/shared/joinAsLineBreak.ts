import { Extension } from "@tiptap/core";

/**
 * Backspace no inicio de um paragrafo aproxima as linhas antes de fundi-las.
 *
 * O comportamento padrao do editor junta os dois paragrafos de uma vez, e o
 * texto sai emendado na mesma linha: "...apos uma refeicao.Ou conforme
 * orientacao...". Quem so queria diminuir o espaco entre as duas linhas perde o
 * texto de vista e precisa desfazer.
 *
 * Aqui o Backspace passa a ter dois estagios, que e o que corresponde ao que se
 * espera ao apertar a tecla:
 *
 *   1. paragrafos separados  ->  mesma linha logica, quebradas por <br>
 *   2. quebradas por <br>    ->  emendadas de fato (comportamento padrao)
 *
 * So vale para paragrafo de primeiro nivel: dentro de lista, o Backspace do
 * editor ja faz a coisa certa (tira o item da lista).
 */
export const JoinAsLineBreak = Extension.create({
  name: "joinAsLineBreak",

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor;
        const { selection, schema } = state;
        const { $from, empty } = selection;

        // Com texto selecionado, Backspace apaga a selecao: nao e o caso aqui.
        if (!empty) return false;
        // No meio do paragrafo o padrao ja apaga um caractere.
        if ($from.parentOffset !== 0) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.depth !== 1) return false;

        const paragraphStart = $from.before();
        const previous = state.doc.resolve(paragraphStart).nodeBefore;
        if (!previous || previous.type.name !== "paragraph") return false;
        // Paragrafo vazio atras: o padrao remove a linha em branco, que e o
        // que se espera.
        if (previous.content.size === 0) return false;

        const hardBreak = schema.nodes.hardBreak;
        if (!hardBreak) return false;

        return this.editor
          .chain()
          .command(({ tr }) => {
            // Troca a fronteira entre os dois paragrafos (o token de fechamento
            // do anterior e o de abertura deste) por uma quebra de linha: o
            // conteudo se junta num paragrafo so, ainda em duas linhas.
            tr.replaceWith(paragraphStart - 1, paragraphStart + 1, hardBreak.create());
            return true;
          })
          .run();
      },
    };
  },
});
