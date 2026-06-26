'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

/** Global toast — dark theme fixed (app is dark-only). */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'border-border/60 bg-popover/95 backdrop-blur-xl',
        },
      }}
      {...props}
    />
  )
}
