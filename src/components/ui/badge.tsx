import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-foreground",
        success:
          "border-success/20 bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400",
        warning:
          "border-warning/20 bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400",
        destructive:
          "border-danger-600/20 bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-400",
        info:
          "border-info/20 bg-info-50 text-info-700 dark:bg-info-950/40 dark:text-info-400",
        /** Distinct blue-gray for SUSPENDED — not confused with warning. */
        suspended:
          "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
