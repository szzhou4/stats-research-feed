import { ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils/date";

interface ContinueBannerProps {
  articleTitle: string;
  updatedAt: number;
  onContinue: () => void;
}

export function ContinueBanner({ articleTitle, updatedAt, onContinue }: ContinueBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Continue where you left off</p>
          <p className="mt-0.5 text-muted-foreground">
            {formatRelativeTime(updatedAt)} · <span className="italic">{articleTitle}</span>
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onContinue} className="shrink-0">
        Continue
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
