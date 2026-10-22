import { PackageOpen } from "lucide-react";
export function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state" role="img" aria-label={label}>
      <PackageOpen aria-hidden="true" />
    </div>
  );
}
