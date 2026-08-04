export const PASSWORD_RECOVERY_STORAGE_KEY = "clinicplus_password_recovery";
const PASSWORD_RECOVERY_PENDING_VALUE = "pending";

function hasPasswordRecoveryUrlHint(): boolean {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const isRecoveryPath = window.location.pathname === "/recuperar-senha";
  const isRecoveryType =
    searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    searchParams.get("mode") === "recovery";
  const hasRecoveryToken =
    searchParams.has("code") ||
    searchParams.has("token_hash") ||
    hashParams.has("access_token");

  return (
    isRecoveryType ||
    (isRecoveryPath && hasRecoveryToken)
  );
}

export function readPasswordRecoveryMarker(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isPasswordRecoveryPendingFor(userId: string): boolean {
  const marker = readPasswordRecoveryMarker();
  return marker === PASSWORD_RECOVERY_PENDING_VALUE || marker === userId;
}

export function writePasswordRecoveryMarker(userId?: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, userId || PASSWORD_RECOVERY_PENDING_VALUE);
  } catch {
    // The in-memory auth state still protects the current tab when storage is unavailable.
  }
}

export function clearPasswordRecoveryMarker(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function capturePasswordRecoveryIntent(): boolean {
  const hasRecoveryHint = hasPasswordRecoveryUrlHint();
  if (hasRecoveryHint && !readPasswordRecoveryMarker()) {
    writePasswordRecoveryMarker();
  }
  return hasRecoveryHint;
}
