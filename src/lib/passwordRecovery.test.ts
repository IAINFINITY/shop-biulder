import { describe, expect, it, beforeEach } from "vitest";
import {
  PASSWORD_RECOVERY_STORAGE_KEY,
  capturePasswordRecoveryIntent,
  readPasswordRecoveryMarker,
} from "@/lib/passwordRecovery";

function setPath(path: string) {
  window.history.pushState({}, "", path);
}

describe("passwordRecovery", () => {
  beforeEach(() => {
    window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    setPath("/");
  });

  it("does not treat signup confirmation callbacks as password recovery", () => {
    setPath("/?code=abc123&type=signup");

    expect(capturePasswordRecoveryIntent()).toBe(false);
    expect(readPasswordRecoveryMarker()).toBeNull();
  });

  it("captures password recovery only on the recovery route", () => {
    setPath("/recuperar-senha?code=abc123&type=recovery");

    expect(capturePasswordRecoveryIntent()).toBe(true);
    expect(readPasswordRecoveryMarker()).toBe("pending");
  });
});
