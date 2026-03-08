import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface LoadingSpinnerProps {
  className?: string
  text?: string
}

export default function LoadingSpinner({ className, text }: LoadingSpinnerProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      {text && <p className="text-sm text-surface-500">{text}</p>}
    </div>
  )
}
