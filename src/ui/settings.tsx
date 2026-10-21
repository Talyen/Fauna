import { useState } from "react";
import type { Session } from "../application/session";
import { DisplaySettings, CloudStatus } from "./platform-settings";
import { Monitor, Headphones, Swords, CaseSensitive, MessageSquareText, StepForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
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
  desktop,
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
  const [category, setCategory] = useState("display");
  return (
    <Tabs value={category} onValueChange={setCategory} className="settings-controls">
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
        className="settings-panel"
        inert={category !== "display"}
        aria-hidden={category !== "display"}
        tabIndex={category === "display" ? 0 : -1}
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
        className="settings-panel"
        inert={category !== "sound"}
        aria-hidden={category !== "sound"}
        tabIndex={category === "sound" ? 0 : -1}
      >
        <AudioSettings value={audio} update={updateAudio} />
      </TabsContent>
      <TabsContent
        value="battle"
        className="settings-panel"
        inert={category !== "battle"}
        aria-hidden={category !== "battle"}
        tabIndex={category === "battle" ? 0 : -1}
      >
        <h2 className="settings-heading">Battle</h2>
        <SettingToggle
          icon={StepForward}
          label="Auto-end turn"
          checked={autoEndTurn}
          onChange={setAutoEndTurn}
        />
      </TabsContent>
      {desktop && session ? <CloudStatus session={session} /> : null}
    </Tabs>
  );
}
