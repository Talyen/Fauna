import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import type { AudioPreferences } from "./audio-preferences";
export function AudioSettings({
  value,
  update,
}: {
  value: AudioPreferences;
  update: (patch: Partial<AudioPreferences>) => void;
}) {
  return (
    <fieldset>
      <legend>Audio</legend>
      <label data-nav-row className="setting-row" htmlFor="sound-setting">
        <span>Sound</span>
        <Switch
          id="sound-setting"
          checked={value.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
        />
      </label>
      {(
        [
          ["master", "Master"],
          ["music", "Music"],
          ["effects", "Sound effects"],
        ] as const
      ).map(([key, label]) => (
        <div data-nav-row key={key} className="setting-row" role="group" aria-label={`${label} volume`}>
          <span>{label}</span>
          <div className="volume-controls">
            <Button
              variant="outline"
              size="icon"
              aria-label={`Decrease ${label} volume`}
              disabled={value[key] === 0}
              onClick={() => update({ [key]: Math.max(0, value[key] - 10) })}
            >
              −
            </Button>
            <output aria-live="polite" aria-label={`${label} volume value`}>
              {value[key]}%
            </output>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Increase ${label} volume`}
              disabled={value[key] === 100}
              onClick={() => update({ [key]: Math.min(100, value[key] + 10) })}
            >
              +
            </Button>
          </div>
        </div>
      ))}
      <label data-nav-row className="setting-row" htmlFor="background-mute">
        <span>Mute in background</span>
        <Switch
          id="background-mute"
          checked={value.muteInBackground}
          onCheckedChange={(muteInBackground) => update({ muteInBackground })}
        />
      </label>
    </fieldset>
  );
}
