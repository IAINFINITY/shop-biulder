import { describe, expect, it } from "vitest";

import {
  PROXIS_SYNC_ERROR,
  PROXIS_SYNC_LEGACY,
  PROXIS_SYNC_PENDING,
  PROXIS_SYNC_SENT,
  buildProxisDocPedWeb,
  isSubmissionKey,
  needsProxisReconciliation,
  newSubmissionKey,
  normalizeProxisSyncStatus,
} from "@/lib/proxisOrderStatus";

const KEY_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const KEY_B = "b1ee7c4a-6d2b-4f7a-8c19-2f1a7d5e9b40";

describe("doc_ped_web derivado do submission_key", () => {
  it("gera sempre o mesmo documento para a mesma chave", () => {
    // Esta e a garantia que impede o reenvio de duplicar o pedido no ERP.
    expect(buildProxisDocPedWeb(KEY_A)).toBe(buildProxisDocPedWeb(KEY_A));
  });

  it("gera documentos diferentes para pedidos diferentes", () => {
    expect(buildProxisDocPedWeb(KEY_A)).not.toBe(buildProxisDocPedWeb(KEY_B));
  });

  it("mantem o formato aceito pelo ERP", () => {
    expect(buildProxisDocPedWeb(KEY_A)).toMatch(/^INFINITY-[0-9A-Z]{8}$/);
  });

  it("ignora a formatacao da chave", () => {
    expect(buildProxisDocPedWeb(KEY_A.toUpperCase())).toBe(buildProxisDocPedWeb(KEY_A));
    expect(buildProxisDocPedWeb(KEY_A.replace(/-/g, ""))).toBe(buildProxisDocPedWeb(KEY_A));
  });

  it("devolve null quando nao ha chave utilizavel", () => {
    expect(buildProxisDocPedWeb(null)).toBeNull();
    expect(buildProxisDocPedWeb(undefined)).toBeNull();
    expect(buildProxisDocPedWeb("")).toBeNull();
    expect(buildProxisDocPedWeb("abc")).toBeNull();
  });
});

describe("chave de idempotencia do pedido", () => {
  it("produz um UUID valido", () => {
    const key = newSubmissionKey();
    expect(isSubmissionKey(key)).toBe(true);
    expect(buildProxisDocPedWeb(key)).not.toBeNull();
  });

  it("nao repete chaves", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newSubmissionKey()));
    expect(keys.size).toBe(50);
  });

  it("rejeita valores que nao sao UUID", () => {
    expect(isSubmissionKey("")).toBe(false);
    expect(isSubmissionKey("123")).toBe(false);
    expect(isSubmissionKey(null)).toBe(false);
  });
});

describe("status de sincronia", () => {
  it("reconhece os status conhecidos", () => {
    expect(normalizeProxisSyncStatus(PROXIS_SYNC_SENT)).toBe(PROXIS_SYNC_SENT);
    expect(normalizeProxisSyncStatus("ERRO")).toBe(PROXIS_SYNC_ERROR);
    expect(normalizeProxisSyncStatus(" legado ")).toBe(PROXIS_SYNC_LEGACY);
  });

  it("trata valor desconhecido como pendente", () => {
    // Na duvida o pedido entra na fila: e melhor conferir a mais do que perder um.
    expect(normalizeProxisSyncStatus(null)).toBe(PROXIS_SYNC_PENDING);
    expect(normalizeProxisSyncStatus("qualquer coisa")).toBe(PROXIS_SYNC_PENDING);
  });

  it("coloca na fila apenas o que precisa de reconciliacao", () => {
    expect(needsProxisReconciliation(PROXIS_SYNC_PENDING)).toBe(true);
    expect(needsProxisReconciliation(PROXIS_SYNC_ERROR)).toBe(true);
    expect(needsProxisReconciliation(PROXIS_SYNC_SENT)).toBe(false);
    expect(needsProxisReconciliation(PROXIS_SYNC_LEGACY)).toBe(false);
  });
});
