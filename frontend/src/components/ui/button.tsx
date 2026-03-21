"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonShellVariants = cva(
  "group relative inline-flex align-middle disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const buttonBackdropClassName =
  "pointer-events-none absolute inset-0 rounded-[2px] bg-[#161616] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-active:opacity-100";

const buttonVariants = cva(
  "relative z-10 inline-flex w-full items-center justify-center whitespace-nowrap rounded-[2px] border-2 border-foreground font-mono text-sm uppercase tracking-[0.08em] transition-[transform,background-color,border-color,color] duration-200 ease-out group-hover:-translate-x-[2px] group-hover:-translate-y-[2px] group-active:-translate-x-px group-active:-translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-card text-card-foreground",
        ghost: "border-border bg-transparent text-foreground",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <button
      className={cn(buttonShellVariants(), className)}
      ref={ref}
      {...props}
    >
      <span aria-hidden="true" className={buttonBackdropClassName} />
      <span className={buttonVariants({ variant, size })}>{children}</span>
    </button>
  ),
);
Button.displayName = "Button";

export { Button, buttonBackdropClassName, buttonShellVariants, buttonVariants };
