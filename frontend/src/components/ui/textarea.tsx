import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-40 w-full rounded-[2px] border-2 border-foreground bg-card px-4 py-4 text-sm leading-6 text-foreground shadow-[4px_4px_0_rgba(17,17,17,0.08)] transition-[box-shadow,transform,border-color,background-color] duration-200 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
