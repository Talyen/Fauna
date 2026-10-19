export interface SaveCandidate {
  source: string;
  data: string;
}
export interface SaveStorage {
  readCandidates(): Promise<SaveCandidate[]>;
  write(data: string): Promise<void>;
}
export interface SteamCapabilities {
  readonly available: boolean;
  cloud?: { read(): Promise<string | null>; write(data: string): Promise<void> };
  achievements?: { unlock(id: string): Promise<void> };
}
export interface Platform {
  saves: SaveStorage;
  steam: SteamCapabilities;
  desktop: boolean;
  quit?: () => Promise<void>;
  onCloseRequested?: (listener: () => Promise<boolean>) => () => void;
}
export interface DesktopBridge {
  readCandidates(): Promise<SaveCandidate[]>;
  writeSave(data: string): Promise<void>;
  quit(): Promise<void>;
  onCloseRequested(listener: () => Promise<boolean>): () => void;
}
declare global {
  interface Window {
    faunaDesktop?: DesktopBridge;
  }
}
