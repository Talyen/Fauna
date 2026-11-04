import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "../../components/ui/select";
import { useState } from "react";
import {
  Eclipse,
  Sparkles,
  Languages,
  Monitor,
  Headphones,
  Swords,
  MessageSquareText,
  StepForward,
  Scaling,
  Sun,
  Brain,
  Sliders,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../shared/localization/provider";
import { LANGUAGES } from "../shared/localization/languages";
import { useMessages } from "../shared/localization/message-context";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { EffectBaseline } from "../shared/effects/effects";
import { effectPalette } from "../shared/effects/palettes";
import { Confirmation } from "../shared/confirmation";
import type { Session } from "../../application/session";
import { DisplaySettings } from "./platform-settings";
import { defaultDevicePreferences, type DevicePreferences, type PreferencesPatch } from "./preferences";
import { AudioSettings } from "./audio-settings";
import { SettingRow, SettingToggle } from "./settings-controls";

export function Settings({
  session,
  preferences,
  update,
  onClear,
}: {
  session: Session;
  preferences: DevicePreferences;
  update: (patch: PreferencesPatch) => void;
  onClear: () => void;
}) {
  const i18n = useMessages();
  const language = useLanguage();
  const [tab, setTab] = useState("display");
  const [clear, setClear] = useState(false);
  const reset = () => {
    update(defaultDevicePreferences);
    language.setPreference("auto");
    void session.display?.set("windowed");
  };
  return (
    <>
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
            {i18n.message("settings.gameplay", "Gameplay")}
          </TabsTrigger>
          <TabsTrigger value="other">
            <Sliders aria-hidden="true" />
            {i18n.message("settings.other", "Other")}
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
          {language.options.length > 1 ? (
            <SettingRow icon={Languages} label={i18n.message("settings.language", "Language")}>
              <Select
                value={language.preference}
                onValueChange={(value) => language.setPreference(value as typeof language.preference)}
              >
                <SelectTrigger aria-label={i18n.message("settings.language", "Language")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{i18n.message("settings.automatic", "Automatic")}</SelectItem>
                  {language.options.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      <span lang={locale}>{LANGUAGES[locale].name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          ) : null}
          <DisplaySettings session={session} />
          {(
            [
              ["brightness", i18n.message("settings.brightness", "Brightness"), Sun, 50, 150, 1],
              ["scale", i18n.message("settings.gameSize", "Game Size"), Scaling, 80, 120, 5],
              [
                "tooltipScale",
                i18n.message("settings.tooltipSize", "Tooltip size"),
                MessageSquareText,
                90,
                125,
                5,
              ],
              ["glow", i18n.message("settings.glow", "Background Glow"), Eclipse, 0, 100, 1],
              ["particles", i18n.message("settings.particles", "Background Particles"), Sparkles, 0, 100, 1],
            ] as const
          ).map(([key, label, icon, min, max, step]) => {
            const factor = key === "scale" || key === "tooltipScale" ? 100 : 1;
            const value = Math.round(preferences[key] * factor);
            return (
              <SettingRow key={key} icon={icon} label={label}>
                <div className="volume-controls">
                  <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={[value]}
                    onValueChange={([next]) => {
                      if (next !== undefined) update({ [key]: next / factor });
                    }}
                    aria-label={label}
                    aria-valuetext={`${value}%`}
                  />
                  <output>{value}%</output>
                </div>
              </SettingRow>
            );
          })}
        </TabsContent>
        <TabsContent
          value="sound"
          forceMount
          inert={tab !== "sound"}
          aria-hidden={tab !== "sound"}
          className="settings-panel"
        >
          <AudioSettings value={preferences.audio} update={(patch) => update({ audio: patch })} />
        </TabsContent>
        <TabsContent
          value="battle"
          forceMount
          inert={tab !== "battle"}
          aria-hidden={tab !== "battle"}
          className="settings-panel"
        >
          <h2 className="settings-heading">{i18n.message("settings.battle", "Battle")}</h2>
          <SettingToggle
            icon={StepForward}
            label={i18n.message("settings.autoEndTurn", "Auto-end turn")}
            checked={preferences.autoEndTurn}
            onChange={(value) => update({ autoEndTurn: value })}
          />
          <SettingToggle
            icon={Brain}
            label={i18n.message("settings.rememberAutoplay", "Remember Auto-Battle Preference")}
            checked={preferences.rememberAutoplay}
            onChange={(value) => update({ rememberAutoplay: value })}
          />
        </TabsContent>
        <TabsContent
          value="other"
          forceMount
          inert={tab !== "other"}
          aria-hidden={tab !== "other"}
          className="settings-panel"
        >
          <h2 className="settings-heading">{i18n.message("settings.resetSave", "Reset & Save Data")}</h2>
          <SettingRow icon={RotateCcw} label={i18n.message("menu.settings", "Settings")}>
            <Button variant="outline" onClick={reset}>
              {i18n.message("settings.resetDefault", "Reset to Default")}
            </Button>
          </SettingRow>
          {session.canClearProgress ? (
            <SettingRow icon={Trash2} label={i18n.message("settings.saveData", "Save Data")}>
              <Button variant="destructive" onClick={() => setClear(true)}>
                {i18n.message("settings.clearSave", "Clear Save Data")}
              </Button>
            </SettingRow>
          ) : null}
        </TabsContent>
      </Tabs>
      <Confirmation
        open={clear}
        title={i18n.message("settings.clearSave", "Clear Save Data")}
        description={i18n.message(
          "settings.clearConfirm",
          "Clear all progress and start fresh? This cannot be undone",
        )}
        confirmLabel={i18n.message("settings.clearSave", "Clear Save Data")}
        onClose={() => setClear(false)}
        onConfirm={() => {
          setClear(false);
          onClear();
        }}
      />
    </>
  );
}
