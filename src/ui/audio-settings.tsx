import { AudioLines, Music, Volume2, VolumeX, Power } from "lucide-react";
import { Slider } from "../components/ui/slider";
import type { AudioPreferences } from "./audio-preferences";
import { SettingRow, SettingToggle } from "./settings-controls";
export function AudioSettings({
  value,
  update,
}: {
  value: AudioPreferences;
  update: (patch: Partial<AudioPreferences>) => void;
}) {
  return (
    <section aria-label="Audio">
      <h2 className="settings-heading">Audio</h2>
      <SettingToggle
        icon={Power}
        label="Sound"
        checked={value.enabled}
        onChange={(enabled) => update({ enabled })}
      />
      {(
        [
          ["master", "Master", Volume2],
          ["music", "Music", Music],
          ["effects", "Sound effects", AudioLines],
        ] as const
      ).map(([key, label, icon]) => (
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
              aria-label={`${label} volume`}
              aria-valuetext={`${value[key]}%`}
            />
            <output aria-label={`${label} volume value`}>{value[key]}%</output>
          </div>
        </SettingRow>
      ))}
      <SettingToggle
        icon={VolumeX}
        label="Mute in background"
        checked={value.muteInBackground}
        onChange={(muteInBackground) => update({ muteInBackground })}
      />
    </section>
  );
}
