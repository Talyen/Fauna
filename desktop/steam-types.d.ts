export interface SteamRequests {
  init: { args: [number]; result: string };
  enabled: { args: []; result: boolean };
  list: { args: []; result: string[] };
  read: { args: [string]; result: string | null };
  write: { args: [string, string]; result: true };
}
export type SteamRequest = {
  [K in keyof SteamRequests]: { id: number; operation: K; args: SteamRequests[K]["args"] };
}[keyof SteamRequests];
