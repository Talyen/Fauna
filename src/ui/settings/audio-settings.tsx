import { useMessages } from "../shared/localization/message-context";
import { AudioLines, Music, Volume2, VolumeX, Power } from "lucide-react";
import { Slider } from "../../components/ui/slider";
import type { AudioPreferences } from "./preferences";
import { SettingRow, SettingToggle } from "./settings-controls";
export function AudioSettings({
  value,
  update,
}: {
  value: AudioPreferences;
  update: (patch: Partial<AudioPreferences>) => void;
}) {
  const i18n = useMessages();
  return (
    <section aria-label={i18n.message("settings.audio", "Audio")}>
      <h2 className="settings-heading">{i18n.message("settings.audio", "Audio")}</h2>
      <SettingToggle
        icon={Power}
        label={i18n.message("settings.sound", "Sound")}
        checked={value.enabled}
        onChange={(enabled) => update({ enabled })}
      />
      {(
        [
          [
            "master",
            i18n.message("settings.master", "Master"),
            i18n.message("settings.masterVolume", "Master volume"),
            i18n.message("settings.masterVolumeValue", "Master volume value"),
            Volume2,
          ],
          [
            "music",
            i18n.message("settings.music", "Music"),
            i18n.message("settings.musicVolume", "Music volume"),
            i18n.message("settings.musicVolumeValue", "Music volume value"),
            Music,
          ],
          [
            "effects",
            i18n.message("settings.effects", "Sound effects"),
            i18n.message("settings.effectsVolume", "Sound effects volume"),
            i18n.message("settings.effectsVolumeValue", "Sound effects volume value"),
            AudioLines,
          ],
        ] as const
      ).map(([key, label, volumeLabel, valueLabel, icon]) => (
        <SettingRow key={key} icon={icon} label={label}>
          <div className="volume-controls">
            <Slider
              min={0}
              max={100}
              step={10}
              value={[value[key]]}
              onValueChange={([volume]) => {
                if (volume !== undefined) update({ [key]: volume });
              }}
              aria-label={volumeLabel}
              aria-valuetext={`${value[key]}%`}
            />
            <output aria-label={valueLabel}>{value[key]}%</output>
          </div>
        </SettingRow>
      ))}
      <SettingToggle
        icon={VolumeX}
        label={i18n.message("settings.muteBackground", "Mute in background")}
        checked={value.muteInBackground}
        onChange={(muteInBackground) => update({ muteInBackground })}
      />
    </section>
  );
}
