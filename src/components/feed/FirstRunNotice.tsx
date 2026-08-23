import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FirstRunNoticeProps {
  onDismiss: () => void;
}

export function FirstRunNotice({ onDismiss }: FirstRunNoticeProps) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-secondary/25 bg-secondary/5 px-4 py-3 text-sm text-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p>
          Welcome to your research feed. A few things worth knowing: you can customize which
          journals appear using <span className="font-medium">Manage journals</span>; which
          articles you&apos;ve seen is tracked automatically and stored only in this browser; and
          the feed remembers where you left off when you come back.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={onDismiss}
        aria-label="Dismiss this notice"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
