import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { LANGUAGES, type LanguagePreference } from "../shared/localization/languages";
import { useLanguage } from "../shared/localization/provider";
import { useMessages } from "../shared/localization/message-context";

export function LanguageChoices() {
  const language = useLanguage();
  const i18n = useMessages();
  const choices: LanguagePreference[] = ["auto", ...language.options];
  return (
    <RadioGroup
      className="language-choices"
      orientation="vertical"
      aria-label={i18n.message("settings.language", "Language")}
      value={language.preference}
      onValueChange={(value) => {
        if (value !== "auto" && !language.options.some((locale) => locale === value)) return;
        language.setPreference(value as LanguagePreference);
      }}
    >
      {choices.map((value) => (
        <label className="text-size-option" key={value}>
          <RadioGroupItem
            value={value}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.click();
            }}
          />
          <span lang={value === "auto" ? undefined : value}>
            {value === "auto" ? i18n.message("settings.automatic", "Automatic") : LANGUAGES[value].name}
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
