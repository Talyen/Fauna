import { Slider } from "../../components/ui/slider";
import { Eclipse, Sparkles, Gamepad2 } from "lucide-react";
import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import type { useEffectPreferences } from "./effect-preferences";
import { useState } from "react";
import type { Session } from "../../application/session";
import { DisplaySettings } from "./platform-settings";
import { Monitor, Headphones, Swords, CaseSensitive, MessageSquareText, StepForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import type { AudioPreferences } from "./audio-preferences";
import { AudioSettings } from "./audio-settings";
import { SettingRow, SettingToggle } from "./settings-controls";
import type { ControllerPreference } from "../shared/navigation/controller-prompts";
export const TEXT_SCALES = [0.75, 1, 1.25] as const;

export function Settings({
  effects,
  session,
  audio,
  updateAudio,
  scale,
  setScale,
  tooltipScale,
  setTooltipScale,
  autoEndTurn,
  setAutoEndTurn,
  controller = "auto",
  setController,
}: {
  effects?: ReturnType<typeof useEffectPreferences>;
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
  controller?: ControllerPreference;
  setController?: (value: ControllerPreference) => void;
}) {
  const [tab, setTab] = useState("display");
  return (
    <Tabs value={tab} onValueChange={setTab} className="settings-controls">
      <EffectBaseline palette={effectPalette([], "gold")} />
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
        {(
          [
            ["glow", "Background Glow", Eclipse],
            ["particles", "Background Particles", Sparkles],
          ] as const
        ).map(([key, label, icon]) => (
          <SettingRow key={key} icon={icon} label={label}>
            <div className="volume-controls">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[effects?.[key] ?? 100]}
                onValueChange={([value]) => {
                  if (value !== undefined) effects?.update(key, value);
                }}
                aria-label={label}
                aria-valuetext={`${effects?.[key] ?? 100}%`}
              />
              <output aria-label={`${label} value`}>{effects?.[key] ?? 100}%</output>
            </div>
          </SettingRow>
        ))}
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
        <SettingRow icon={Gamepad2} label="Controller prompts">
          <RadioGroup
            orientation="horizontal"
            className="controller-prompt-options"
            aria-label="Controller prompts"
            value={controller}
            onValueChange={(value) => {
              if (value === "auto" || value === "xbox" || value === "playstation" || value === "nintendo")
                setController?.(value);
            }}
          >
            {(
              [
                ["auto", "Automatic"],
                ["xbox", "Xbox / Deck"],
                ["playstation", "PlayStation"],
                ["nintendo", "Nintendo"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={value} aria-label={label} />
                {label}
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
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
