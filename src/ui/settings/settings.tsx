import { useMessages } from "../shared/localization/message-context";
import { Slider } from "../../components/ui/slider";
import { Eclipse, Sparkles, Gamepad2 } from "lucide-react";
import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import { useState } from "react";
import type { Session } from "../../application/session";
import { DisplaySettings } from "./platform-settings";
import { Monitor, Headphones, Swords, CaseSensitive, MessageSquareText, StepForward } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { TEXT_SCALES, type DevicePreferences, type PreferencesPatch } from "./preferences";
import { AudioSettings } from "./audio-settings";
import { SettingRow, SettingToggle } from "./settings-controls";

export function Settings({
  session,
  preferences,
  update,
}: {
  session: Session;
  preferences: DevicePreferences;
  update: (patch: PreferencesPatch) => void;
}) {
  const i18n = useMessages();
  const { audio, scale, tooltipScale, autoEndTurn, controller } = preferences;
  const [tab, setTab] = useState("display");
  return (
    <Tabs value={tab} onValueChange={setTab} className="settings-controls" data-nav-layout="rows">
      <EffectBaseline palette={effectPalette([], "gold")} />
      <TabsList
        data-nav-row
        aria-label={i18n.message("settings.categories", "Settings categories")}
        className="settings-tabs"
      >
        <TabsTrigger value="display">
          <Monitor aria-hidden="true" />
          {i18n.message("settings.display", "Display")}
        </TabsTrigger>
        <TabsTrigger value="sound">
          <Headphones aria-hidden="true" />
          {i18n.message("settings.sound", "Sound")}
        </TabsTrigger>
        <TabsTrigger value="battle">
          <Swords aria-hidden="true" />
          {i18n.message("settings.battle", "Battle")}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="display"
        forceMount
        inert={tab !== "display"}
        aria-hidden={tab !== "display"}
        className="settings-panel"
      >
        <h2 className="settings-heading">{i18n.message("settings.display", "Display")}</h2>
        <DisplaySettings session={session} />
        <SettingRow icon={CaseSensitive} label={i18n.message("settings.textSize", "Text size")}>
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label={i18n.message("settings.textSize", "Text size")}
            value={String(scale)}
            onValueChange={(value) => update({ scale: Number(value) })}
          >
            {TEXT_SCALES.map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem value={String(value)} aria-label={`${value * 100}%`} />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
        <SettingRow icon={MessageSquareText} label={i18n.message("settings.tooltipSize", "Tooltip size")}>
          <RadioGroup
            orientation="horizontal"
            className="text-size-options"
            aria-label={i18n.message("settings.tooltipSize", "Tooltip size")}
            value={String(tooltipScale)}
            onValueChange={(value) => update({ tooltipScale: Number(value) })}
          >
            {TEXT_SCALES.map((value) => (
              <label key={value} className="text-size-option">
                <RadioGroupItem
                  value={String(value)}
                  aria-label={i18n.message("settings.tooltipPercent", "Tooltip {{value}}%", {
                    value: value * 100,
                  })}
                />
                <span>{value * 100}%</span>
              </label>
            ))}
          </RadioGroup>
        </SettingRow>
        {(
          [
            [
              "glow",
              i18n.message("settings.glow", "Background Glow"),
              i18n.message("settings.glowValue", "Background Glow value"),
              Eclipse,
            ],
            [
              "particles",
              i18n.message("settings.particles", "Background Particles"),
              i18n.message("settings.particlesValue", "Background Particles value"),
              Sparkles,
            ],
          ] as const
        ).map(([key, label, valueLabel, icon]) => (
          <SettingRow key={key} icon={icon} label={label}>
            <div className="volume-controls">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[preferences[key]]}
                onValueChange={([value]) => {
                  if (value !== undefined) update({ [key]: value });
                }}
                aria-label={label}
                aria-valuetext={`${preferences[key]}%`}
              />
              <output aria-label={valueLabel}>{preferences[key]}%</output>
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
        <AudioSettings value={audio} update={(patch) => update({ audio: patch })} />
      </TabsContent>
      <TabsContent
        value="battle"
        forceMount
        inert={tab !== "battle"}
        aria-hidden={tab !== "battle"}
        className="settings-panel"
      >
        <h2 className="settings-heading">{i18n.message("settings.battle", "Battle")}</h2>
        <SettingRow icon={Gamepad2} label={i18n.message("settings.controllerPrompts", "Controller prompts")}>
          <RadioGroup
            orientation="horizontal"
            className="controller-prompt-options"
            aria-label={i18n.message("settings.controllerPrompts", "Controller prompts")}
            value={controller}
            onValueChange={(value) => {
              if (value === "auto" || value === "xbox" || value === "playstation" || value === "nintendo")
                update({ controller: value });
            }}
          >
            {(
              [
                ["auto", i18n.message("settings.automatic", "Automatic")],
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
          label={i18n.message("settings.autoEndTurn", "Auto-end turn")}
          checked={autoEndTurn}
          onChange={(value) => update({ autoEndTurn: value })}
        />
      </TabsContent>
    </Tabs>
  );
}
