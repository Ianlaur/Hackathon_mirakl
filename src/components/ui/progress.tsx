import * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0

    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
        {...props}
      >
        <div
          className="h-full bg-slate-900 transition-all duration-300 ease-out"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
