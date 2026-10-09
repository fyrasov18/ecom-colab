import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-foreground",
        success:
          "border-transparent bg-success-100 text-success-700",
        warning:
          "border-transparent bg-warning-100 text-warning-700",
        destructive:
          "border-transparent bg-danger-100 text-danger-700",
        info:
          "border-transparent bg-info-100 text-info-700",
        /** Distinct blue-gray for SUSPENDED — not confused with warning. */
        suspended:
          "border-transparent bg-slate-100 text-slate-600",
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
