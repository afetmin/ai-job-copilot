import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "paper-field-focus flex min-h-40 w-full rounded-[2px] border-2 border-foreground bg-card px-4 py-4 text-sm leading-6 text-foreground shadow-[4px_4px_0_rgba(17,17,17,0.08)] placeholder:text-muted-foreground focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
