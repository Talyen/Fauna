import type { DiagnosticPort } from "./ports";
export function browserDiagnostics(storage?: Storage): DiagnosticPort {
  return {
    read: () => (storage ?? localStorage).getItem("fauna.diagnostics"),
    write: (data) => (storage ?? localStorage).setItem("fauna.diagnostics", data),
  };
}

export function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Optional preferences never gate play. */
  }
}
