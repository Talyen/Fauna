import { useState } from "react";
import type { Session } from "../../application/session";
import { DisplaySettings } from "./platform-settings";
import { Monitor, Headphones, Swords, CaseSensitive, MessageSquareText, StepForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import type { AudioPreferences } from "./audio-preferences";
import { AudioSettings } from "./audio-settings";
import { SettingRow, SettingToggle } from "./settings-controls";
export const TEXT_SCALES = [0.75, 1, 1.25] as const;

export function Settings({
  session,
  audio,
  updateAudio,
  scale,
  setScale,
  tooltipScale,
  setTooltipScale,
  autoEndTurn,
  setAutoEndTurn,
}: {
  session?: Session;
  audio: AudioPreferences;
  updateAudio: (patch: Partial<AudioPreferences>) => void;
  scale: number;
  setScale: (value: number) => void;
  tooltipScale: number;
  setTooltipScale: (value: number) => void;
  desktop: boolean;
  autoEndTurn: boolean;
  setAutoEndTurn: (value: boolean) => void;
}) {
  const [tab, setTab] = useState("display");
  return (
    <Tabs value={tab} onValueChange={setTab} className="settings-controls">
      <TabsList data-nav-row aria-label="Settings categories" className="settings-tabs">
        <TabsTrigger value="display">
          <Monitor aria-hidden="true" />
          Display
        </TabsTrigger>
        <TabsTrigger value="sound">
          <Headphones aria-hidden="true" />
          Sound
        </TabsTrigger>
        <TabsTrigger value="battle">
          <Swords aria-hidden="true" />
          Battle
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="display"
        forceMount
        inert={tab !== "display"}
        aria-hidden={tab !== "display"}
        className="settings-panel"
      >
        <h2 className="settings-heading">Display</h2>
        {session ? <DisplaySettings session={session} /> : null}
        <SettingRow icon={CaseSensitive} label="Text size">
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label="Text size"
            value={String(scale)}
            onValueChange={(value) => setScale(Number(value))}
          >
            {TEXT_SCALES.map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={String(value)} aria-label={`${value * 100}%`} />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
        <SettingRow icon={MessageSquareText} label="Tooltip size">
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label="Tooltip size"
            value={String(tooltipScale)}
            onValueChange={(value) => setTooltipScale(Number(value))}
          >
            {TEXT_SCALES.map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={String(value)} aria-label={`Tooltip ${value * 100}%`} />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
      </TabsContent>
      <TabsContent
        value="sound"
        forceMount
        inert={tab !== "sound"}
        aria-hidden={tab !== "sound"}
        className="settings-panel"
      >
        <AudioSettings value={audio} update={updateAudio} />
      </TabsContent>
      <TabsContent
        value="battle"
        forceMount
        inert={tab !== "battle"}
        aria-hidden={tab !== "battle"}
        className="settings-panel"
      >
        <h2 className="settings-heading">Battle</h2>
        <SettingToggle
          icon={StepForward}
          label="Auto-end turn"
          checked={autoEndTurn}
          onChange={setAutoEndTurn}
        />
      </TabsContent>
    </Tabs>
  );
}
