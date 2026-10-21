import type { DiagnosticPort } from "./ports";
export function browserDiagnostics(): DiagnosticPort {
  return {
    read: () => localStorage.getItem("fauna.diagnostics"),
    write: (data) => localStorage.setItem("fauna.diagnostics", data),
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
