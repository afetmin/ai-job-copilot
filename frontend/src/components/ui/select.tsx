"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
};

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      contentClassName,
      disabled = false,
      id,
      name,
      onValueChange,
      options,
      placeholder,
      value,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const selectedOption = options.find((option) => option.value === value);
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );

    React.useEffect(() => {
      if (!open) {
        return;
      }

      function handlePointerDown(event: MouseEvent) {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      }

      function handleEscape(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [open]);

    React.useEffect(() => {
      if (!open) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        optionRefs.current[selectedIndex]?.focus();
      });

      return () => window.cancelAnimationFrame(frameId);
    }, [open, selectedIndex]);

    function commitValue(nextValue: string) {
      onValueChange(nextValue);
      setOpen(false);
      triggerRef.current?.focus();
    }

    function focusOption(index: number) {
      const boundedIndex = Math.max(0, Math.min(index, options.length - 1));
      optionRefs.current[boundedIndex]?.focus();
    }

    function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (disabled) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
      }
    }

    function handleOptionKeyDown(
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      optionValue: string,
    ) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusOption(index + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusOption(index - 1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        focusOption(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        focusOption(options.length - 1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        commitValue(optionValue);
      }
    }

    return (
      <div className={cn("relative", className)} ref={rootRef}>
        {name ? <input name={name} readOnly type="hidden" value={value} /> : null}
        <button
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "paper-field-focus group flex h-12 w-full items-stretch overflow-hidden rounded-[2px] border-2 border-foreground bg-card text-left shadow-[4px_4px_0_rgba(17,17,17,0.08)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          disabled={disabled}
          id={id}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          ref={(node) => {
            triggerRef.current = node;

            if (typeof ref === "function") {
              ref(node);
            }

            if (ref && typeof ref !== "function") {
              ref.current = node;
            }
          }}
          type="button"
        >
          <span className="min-w-0 flex-1 px-4 py-3">
            <span className="block truncate font-mono text-sm uppercase tracking-[0.04em] text-foreground">
              {selectedOption?.label ?? placeholder ?? "请选择"}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "flex w-12 shrink-0 items-center justify-center border-l-2 border-foreground/80",
              "bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,238,230,0.95))]",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200 ease-out",
                open ? "rotate-180" : "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </span>
        </button>

        {open ? (
          <div
            className={cn(
              "absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-[2px] border-2 border-foreground",
              "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,241,234,0.98))]",
              "shadow-[7px_7px_0_rgba(17,17,17,0.12)]",
              "animate-[select-pop_180ms_ease-out]",
              contentClassName,
            )}
          >
            <div className="paper-scrollbar-compact max-h-64 overflow-y-auto p-1.5">
              <div
                aria-orientation="vertical"
                id={id ? `${id}-listbox` : undefined}
                role="listbox"
              >
                {options.map((option, index) => {
                  const isSelected = option.value === value;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[2px] px-3 py-3 text-left transition-colors duration-150 ease-out",
                        isSelected
                          ? "bg-[rgba(97,184,255,0.16)] text-foreground"
                          : "text-foreground/88 hover:bg-[rgba(58,57,63,0.06)]",
                        "focus-visible:bg-[rgba(58,57,63,0.08)] focus-visible:outline-none",
                      )}
                      key={option.value}
                      onClick={() => commitValue(option.value)}
                      onKeyDown={(event) => handleOptionKeyDown(event, index, option.value)}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      tabIndex={isSelected ? 0 : -1}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-foreground/25",
                          isSelected
                            ? "bg-card text-foreground"
                            : "bg-transparent text-transparent",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1 font-mono text-sm uppercase tracking-[0.04em]">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";

export type { SelectOption, SelectProps };
