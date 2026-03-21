import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="mono-kicker text-foreground">{eyebrow}</p>
      <div className="space-y-2">
        <h1 className="ink-title text-[clamp(2.6rem,8vw,5.2rem)] leading-[1.02] text-foreground">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}
