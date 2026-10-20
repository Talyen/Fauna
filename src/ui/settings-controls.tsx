import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "../components/ui/switch";

export function SettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div data-nav-row className="setting-row">
      <span className="setting-label">
        <Icon aria-hidden="true" />
        {label}
      </span>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function SettingToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div data-nav-row className="setting-row setting-toggle">
      <label className="setting-label" htmlFor={id}>
        <Icon aria-hidden="true" />
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
