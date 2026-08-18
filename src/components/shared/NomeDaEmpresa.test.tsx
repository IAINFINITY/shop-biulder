import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NomeDaEmpresa } from "@/components/shared/NomeDaEmpresa";

/** Os três Empresários Individuais reais do cadastro, com o MEI que a Receita informa. */
const PATRICIA = { company: "26.041.551 PATRICIA GUEDES MAZUI PIASSUM", cnpj: "26041551000197", isMei: true };
const MARCIO = { company: "54.626.438 MARCIO DIAS", cnpj: "54626438000109", isMei: false };
const JOSE = { company: "66.121.553 JOSE FRANCISCO DE ARAUJO NETO", cnpj: "66121553000100", isMei: true };

describe("NomeDaEmpresa", () => {
  it("tira o CNPJ da frente do nome", () => {
    render(<NomeDaEmpresa {...JOSE} />);
    expect(screen.getByText("JOSE FRANCISCO DE ARAUJO NETO")).toBeInTheDocument();
    expect(screen.queryByText(/66\.121\.553/)).not.toBeInTheDocument();
  });

  it("mostra o selo para quem é MEI", () => {
    render(<NomeDaEmpresa {...PATRICIA} />);
    expect(screen.getByText("MEI")).toBeInTheDocument();
  });

  it("NÃO mostra o selo para Empresário Individual que não é MEI", () => {
    /**
     * O caso que sustenta o desenho inteiro.
     *
     * Marcio Dias tem exatamente o mesmo formato de razão social dos outros
     * dois — nome gerado pela Receita a partir do CNPJ — e **não é MEI**. Se o
     * selo saísse do padrão do nome, ele apareceria rotulado errado, com o
     * próprio nome do lado.
     */
    render(<NomeDaEmpresa {...MARCIO} />);
    expect(screen.getByText("MARCIO DIAS")).toBeInTheDocument();
    expect(screen.queryByText("MEI")).not.toBeInTheDocument();
  });

  it("sem consulta à Receita, não afirma nada", () => {
    // `null` é "ainda não perguntamos", e não "não é". Nenhum selo.
    render(<NomeDaEmpresa company={JOSE.company} cnpj={JOSE.cnpj} isMei={null} />);
    expect(screen.queryByText("MEI")).not.toBeInTheDocument();
    // Mas a limpeza do nome não depende disso — ela vem do próprio CNPJ.
    expect(screen.getByText("JOSE FRANCISCO DE ARAUJO NETO")).toBeInTheDocument();
  });

  it("empresa com razão social própria fica intacta", () => {
    render(<NomeDaEmpresa company="Alpha Distribuição" cnpj="14351538000155" isMei={false} />);
    expect(screen.getByText("Alpha Distribuição")).toBeInTheDocument();
  });

  it("sem nome, mostra o texto de reserva", () => {
    render(<NomeDaEmpresa company="" cnpj="14351538000155" fallback="Sem empresa vinculada" />);
    expect(screen.getByText("Sem empresa vinculada")).toBeInTheDocument();
  });

  it("o selo não encolhe junto com o nome", () => {
    // O nome usa `truncate`; sem `shrink-0` no selo, um nome longo comeria
    // justamente a informação que o cliente pediu para conseguir ver.
    render(<NomeDaEmpresa {...PATRICIA} />);
    expect(screen.getByText("MEI").className).toContain("shrink-0");
  });
});
