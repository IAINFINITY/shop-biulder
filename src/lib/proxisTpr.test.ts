import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROXSIS_TPR_ID,
  isB2bProxisTprId,
  normalizeProxisTprId,
  resolveConfiguredProxisTprId,
  resolveCustomerProxisTpr,
} from "@/lib/proxisTpr";

describe("Proxis TPR rules", () => {
  it("uses 8728 when the configuration is missing or invalid", () => {
    expect(resolveConfiguredProxisTprId(undefined)).toBe(DEFAULT_PROXSIS_TPR_ID);
    expect(resolveConfiguredProxisTprId("")).toBe(DEFAULT_PROXSIS_TPR_ID);
    expect(resolveConfiguredProxisTprId("invalid")).toBe(DEFAULT_PROXSIS_TPR_ID);
  });

  it("replaces the invalid legacy TPR 8278 with 8728", () => {
    expect(normalizeProxisTprId(8278)).toBe(DEFAULT_PROXSIS_TPR_ID);
    expect(resolveConfiguredProxisTprId("8278")).toBe(DEFAULT_PROXSIS_TPR_ID);
  });

  it("keeps a valid customer-specific TPR", () => {
    expect(resolveCustomerProxisTpr([{ tpr_id: 8745 }])).toEqual({
      tprId: 8745,
      customerTableIds: [8745],
    });
  });

  it("uses 8728 for a customer without a Proxis price table", () => {
    expect(resolveCustomerProxisTpr([])).toEqual({
      tprId: DEFAULT_PROXSIS_TPR_ID,
      customerTableIds: [],
    });
  });

  it("recognizes only the current B2B table IDs", () => {
    expect(isB2bProxisTprId(8728)).toBe(true);
    expect(isB2bProxisTprId(8729)).toBe(true);
    expect(isB2bProxisTprId(8745)).toBe(false);
  });
});
