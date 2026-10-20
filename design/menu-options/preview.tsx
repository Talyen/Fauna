import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "../../src/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../src/components/ui/dialog";
import { Switch } from "../../src/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/radio-group";
import "@fontsource-variable/inter/wght.css";
import "../../src/ui/styles.css";
import "./preview.css";
const options = [
  { id: "A", name: "Ghost", description: "Plain text; subtle hover background" },
  { id: "B", name: "Outline", description: "Outlined choices" },
  { id: "C", name: "Default + Ghost", description: "Filled Continue; quiet secondary choices" },
] as const;
function MenuOptions() {
  const [settings, setSettings] = useState(false);
  const [sound, setSound] = useState(true);
  const [size, setSize] = useState("100");
  return (
    <>
      <div className="menu-comparison">
        {options.map((option) => (
          <section className="menu-sample" key={option.id} aria-label={`Option ${option.id}`}>
            <header className="sample-caption">
              <h2>
                {option.id} · {option.name}
              </h2>
              <p>{option.description}</p>
            </header>
            <main className="home-screen">
              <h1>Fauna</h1>
              <nav aria-label={`Menu ${option.id}`}>
                {["Continue", "Talents", "Collection", "Glossary", "Settings", "End run", "Save & quit"].map(
                  (label, index) => (
                    <Button
                      key={label}
                      variant={
                        option.id === "B" ? "outline" : option.id === "C" && index === 0 ? "default" : "ghost"
                      }
                      onClick={() => {
                        if (label === "Settings") setSettings(true);
                      }}
                    >
                      {label}
                    </Button>
                  ),
                )}
              </nav>
            </main>
          </section>
        ))}
      </div>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="menu-settings-preview" closeLabel="Close settings">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">Settings control preview</DialogDescription>
          <div className="settings-controls">
            <label className="setting-row">
              <span>Sound</span>
              <Switch checked={sound} onCheckedChange={setSound} aria-label="Sound" />
            </label>
            <fieldset>
              <legend>Text size</legend>
              <RadioGroup aria-label="Text size" orientation="vertical" value={size} onValueChange={setSize}>
                {["100", "125", "150"].map((value) => (
                  <label className="setting-row" key={value}>
                    <span>{value}%</span>
                    <RadioGroupItem value={value} aria-label={`${value}%`} />
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<MenuOptions />);
