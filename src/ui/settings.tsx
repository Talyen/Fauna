import { Monitor, Volume2, Bug, Scaling, StepForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import type { Diagnostics } from "../application/diagnostics";
import type { AudioPreferences } from "./audio-preferences";
import { AudioSettings } from "./audio-settings";
import { DiagnosticViewer } from "./diagnostics";
import { SettingRow, SettingToggle } from "./settings-controls";

export function Settings({
  audio,
  updateAudio,
  scale,
  setScale,
  tooltipScale,
  setTooltipScale,
  diagnostics,
  desktop,
  autoEndTurn,
  setAutoEndTurn,
}: {
  audio: AudioPreferences;
  updateAudio: (patch: Partial<AudioPreferences>) => void;
  scale: number;
  setScale: (value: number) => void;
  tooltipScale: number;
  setTooltipScale: (value: number) => void;
  diagnostics: Diagnostics;
  desktop: boolean;
  autoEndTurn: boolean;
  setAutoEndTurn: (value: boolean) => void;
}) {
  return (
    <Tabs defaultValue="display" className="settings-controls">
      <TabsList data-nav-row aria-label="Settings categories" className="settings-tabs">
        <TabsTrigger value="display">
          <Monitor aria-hidden="true" />
          Display
        </TabsTrigger>
        <TabsTrigger value="sound">
          <Volume2 aria-hidden="true" />
          Sound
        </TabsTrigger>
        <TabsTrigger value="battle">
          <StepForward aria-hidden="true" />
          Battle
        </TabsTrigger>
        <TabsTrigger value="diagnostics">
          <Bug aria-hidden="true" />
          Diagnostics
        </TabsTrigger>
      </TabsList>
      <TabsContent value="display" className="settings-panel">
        <h2 className="settings-heading">Display</h2>
        <SettingRow icon={Scaling} label="Text size">
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label="Text size"
            value={String(scale)}
            onValueChange={(value) => setScale(Number(value))}
          >
            {[1, 1.25, 1.5].map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={String(value)} aria-label={`${value * 100}%`} />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
        <SettingRow icon={Scaling} label="Tooltip size">
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label="Tooltip size"
            value={String(tooltipScale)}
            onValueChange={(value) => setTooltipScale(Number(value))}
          >
            {[1, 1.25, 1.5].map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={String(value)} aria-label={`Tooltip ${value * 100}%`} />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
      </TabsContent>
      <TabsContent value="sound" className="settings-panel">
        <AudioSettings value={audio} update={updateAudio} />
      </TabsContent>
      <TabsContent value="battle" className="settings-panel">
        <h2 className="settings-heading">Battle</h2>
        <SettingToggle
          icon={StepForward}
          label="Auto-end turn"
          checked={autoEndTurn}
          onChange={setAutoEndTurn}
        />
      </TabsContent>
      <TabsContent value="diagnostics" className="settings-panel">
        <h2 className="settings-heading">Diagnostics</h2>
        <DiagnosticViewer diagnostics={diagnostics} desktop={desktop} collapsible={false} />
      </TabsContent>
    </Tabs>
  );
}
