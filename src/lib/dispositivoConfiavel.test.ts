import { describe, expect, it } from "vitest";
import {
  avaliarDispositivo,
  calcularExpiracao,
  ehReplay,
  rotularDispositivo,
  VALIDADE_MS,
  type RegistroDeDispositivo,
} from "./dispositivoConfiavel";

const AGORA = new Date("2026-08-08T12:00:00.000Z");

function registro(patch: Partial<RegistroDeDispositivo> = {}): RegistroDeDispositivo {
  return {
    tokenHash: "a".repeat(64),
    expiraEm: new Date(AGORA.getTime() + VALIDADE_MS).toISOString(),
    revogadoEm: null,
    rotacionadoEm: null,
    ...patch,
  };
}

describe("avaliarDispositivo", () => {
  it("autoriza um registro novo, nao revogado e dentro do prazo", () => {
    expect(avaliarDispositivo(registro(), AGORA)).toEqual({ valido: true });
  });

  it("recusa token que o banco nao conhece", () => {
    expect(avaliarDispositivo(null, AGORA)).toEqual({ valido: false, motivo: "desconhecido" });
  });

  it("recusa depois do prazo", () => {
    const vencido = registro({ expiraEm: new Date(AGORA.getTime() - 1).toISOString() });
    expect(avaliarDispositivo(vencido, AGORA)).toEqual({ valido: false, motivo: "expirado" });
  });

  it("recusa no instante exato da expiracao", () => {
    // O limite e `<=`: valer "ate as 12h00" nao pode incluir 12h00:00.000.
    const noLimite = registro({ expiraEm: AGORA.toISOString() });
    expect(avaliarDispositivo(noLimite, AGORA)).toEqual({ valido: false, motivo: "expirado" });
  });

  it("recusa quando a pessoa revogou pela tela", () => {
    const revogado = registro({ revogadoEm: AGORA.toISOString() });
    expect(avaliarDispositivo(revogado, AGORA)).toEqual({ valido: false, motivo: "revogado" });
  });

  it("aponta replay ANTES de expirado, quando o token cabe nos dois casos", () => {
    // Um token rotacionado e vencido e, acima de tudo, um sinal de que existem
    // duas copias. Responder "expirado" esconderia o comprometimento atras de
    // uma causa banal, e quem chama revogaria de menos.
    const ambos = registro({
      rotacionadoEm: AGORA.toISOString(),
      expiraEm: new Date(AGORA.getTime() - 1).toISOString(),
    });
    expect(avaliarDispositivo(ambos, AGORA)).toEqual({ valido: false, motivo: "replay" });
  });

  it("aponta replay antes de revogado, pelo mesmo motivo", () => {
    const ambos = registro({ rotacionadoEm: AGORA.toISOString(), revogadoEm: AGORA.toISOString() });
    expect(avaliarDispositivo(ambos, AGORA)).toEqual({ valido: false, motivo: "replay" });
  });
});

describe("ehReplay", () => {
  it("e verdadeiro so para token ja rotacionado", () => {
    expect(ehReplay(registro({ rotacionadoEm: AGORA.toISOString() }))).toBe(true);
    expect(ehReplay(registro())).toBe(false);
    expect(ehReplay(null)).toBe(false);
  });
});

describe("calcularExpiracao", () => {
  it("da exatamente 30 dias de validade", () => {
    const expira = new Date(calcularExpiracao(AGORA)).getTime();
    expect(expira - AGORA.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("devolve um registro que avaliarDispositivo aceita", () => {
    expect(avaliarDispositivo(registro({ expiraEm: calcularExpiracao(AGORA) }), AGORA)).toEqual({
      valido: true,
    });
  });
});

describe("rotularDispositivo", () => {
  it("junta navegador e sistema quando reconhece os dois", () => {
    const chromeWindows =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    expect(rotularDispositivo(chromeWindows)).toBe("Chrome no Windows");
  });

  it("nao confunde Edge com Chrome", () => {
    // O user-agent do Edge contem "Chrome/" — testar na ordem errada rotularia
    // todo Edge como Chrome, e a pessoa nao acharia a linha do aparelho dela.
    const edge =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0";
    expect(rotularDispositivo(edge)).toBe("Edge no Windows");
  });

  it("nao confunde Chrome com Safari", () => {
    // "Safari/537.36" aparece no Chrome tambem.
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(rotularDispositivo(safari)).toBe("Safari no Mac");
  });

  it("reconhece iPhone", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(rotularDispositivo(iphone)).toBe("Safari no iPhone/iPad");
  });

  it("cai num rotulo generico em vez de quebrar", () => {
    expect(rotularDispositivo(null)).toBe("Aparelho desconhecido");
    expect(rotularDispositivo("")).toBe("Aparelho desconhecido");
    expect(rotularDispositivo("curl/8.4.0")).toBe("Aparelho desconhecido");
  });

  it("nao guarda user-agent gigante", () => {
    // O rotulo e para a pessoa reconhecer a linha, nao para arquivar o UA.
    expect(rotularDispositivo("x".repeat(5000)).length).toBeLessThan(60);
  });
});
