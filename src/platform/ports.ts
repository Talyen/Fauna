export interface DiagnosticPort {
  read(): string | null;
  write(data: string): void;
  copy(data: string): Promise<void>;
}
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
  achievements?: { unlock(id: string): Promise<void> };
}
export interface Platform {
  diagnostics?: DiagnosticPort;
  display?: DisplayPort;
  cloud?: CloudPort;
  onOverlay?: (listener: (active: boolean) => void) => () => void;
  saves: SaveStorage;
  steam: SteamCapabilities;
  desktop: boolean;
  quit?: () => Promise<void>;
  onCloseRequested?: (listener: () => Promise<boolean>) => () => void;
}
export interface DesktopBridge {
  display?: DisplayPort;
  cloud?: CloudPort;
  onOverlay?: (listener: (active: boolean) => void) => () => void;
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

export interface DisplayState {
  mode: "windowed" | "fullscreen";
  error?: string;
}
export interface DisplayPort {
  read(): Promise<DisplayState>;
  set(mode: DisplayState["mode"]): Promise<DisplayState>;
  subscribe(listener: (state: DisplayState) => void): () => void;
}
export interface CloudIdentity {
  enabled?: boolean;
  available: boolean;
  device: string;
  profile: string;
  importAvailable: boolean;
}
export interface CloudPort {
  identity(): Promise<CloudIdentity>;
  readLocal(): Promise<string | null>;
  writeLocal(data: string): Promise<void>;
  acknowledge?(id: string): Promise<void>;
  preserve(records: string[]): Promise<void>;
  importStandalone(use: boolean): Promise<SaveCandidate[]>;
  list(): Promise<string[]>;
  read(name: string): Promise<string | null>;
  write(name: string, data: string): Promise<void>;
}
