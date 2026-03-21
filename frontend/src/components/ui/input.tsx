"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const FILE_INPUT_EMPTY_LABEL = "未选择文件";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", onChange, disabled, ...props }, ref) => {
    const [fileLabel, setFileLabel] = React.useState(FILE_INPUT_EMPTY_LABEL);

    if (type === "file") {
      function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const files = event.target.files;
        const nextLabel =
          files !== null && files.length > 0
            ? Array.from(files)
                .map((file) => file.name)
                .join(", ")
            : FILE_INPUT_EMPTY_LABEL;

        setFileLabel(nextLabel);
        onChange?.(event);
      }

      return (
        <div className={cn("w-full", className)}>
          <input
            {...props}
            ref={ref}
            className="sr-only"
            disabled={disabled}
            onChange={handleFileChange}
            type="file"
          />
          <label
            className={cn(
              "group block cursor-pointer",
              disabled ? "pointer-events-none opacity-50" : undefined,
            )}
            htmlFor={props.id}
          >
            <span className="flex min-h-14 items-center gap-3 rounded-[2px] border-2 border-foreground bg-card px-3 py-2 text-sm text-foreground shadow-[4px_4px_0_rgba(17,17,17,0.08)] transition-[box-shadow,border-color,background-color] duration-200 ease-out">
              <span className="relative inline-flex shrink-0">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[2px] bg-[#161616] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-active:opacity-100"
                />
                <span className="relative z-10 inline-flex h-10 items-center justify-center rounded-[2px] border-2 border-foreground bg-primary px-4 font-mono text-xs uppercase tracking-[0.08em] text-primary-foreground transition-transform duration-200 ease-out group-hover:-translate-x-[2px] group-hover:-translate-y-[2px] group-active:-translate-x-px group-active:-translate-y-px">
                  选择文件
                </span>
              </span>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {fileLabel}
              </span>
            </span>
          </label>
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-[2px] border-2 border-foreground bg-card px-4 py-3 text-sm text-foreground shadow-[4px_4px_0_rgba(17,17,17,0.08)] transition-[box-shadow,transform,border-color,background-color] duration-200 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "h-12 px-4 py-3",
          className,
        )}
        disabled={disabled}
        onChange={onChange}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
