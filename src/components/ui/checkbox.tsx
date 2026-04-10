import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "shrink-0 cursor-pointer border-2 border-muted-foreground/50 bg-transparent transition-colors flex items-center justify-center peer",
  {
    variants: {
      size: {
        md: "h-3.5 w-3.5 rounded [&>svg]:size-2.5",
        lg: "h-4.5 w-4.5 rounded-lg [&>svg]:size-3",
        xl: "h-5.5 w-5.5 rounded-xl [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface CheckboxProps
  extends Omit<React.ComponentProps<"input">, "size" | "type">,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, size, checked, onChange, ...props }, ref) => (
    <span className={cn(checkboxVariants({ size, className }), checked && "bg-primary border-primary")}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        {...props}
      />
      {checked && <Check className="text-primary-foreground" strokeWidth={3} />}
    </span>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox, checkboxVariants }
