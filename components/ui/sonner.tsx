"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      expand={false}
      visibleToasts={4}
      closeButton
      richColors={false}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: `
            group toast
            rounded-2xl
            border
            shadow-lg
            backdrop-blur-xl
            px-4 py-3
            gap-3
            font-medium
          `,

          title: "text-sm font-medium",

          description:
            "text-sm text-muted-foreground mt-1",

          closeButton:
            "border bg-background hover:bg-muted transition-colors",

          success: `
            bg-green-50
            border-green-200
            text-green-950
            dark:bg-green-950/30
            dark:border-green-900
            dark:text-green-100
          `,

          error: `
            bg-red-50
            border-red-200
            text-red-950
            dark:bg-red-950/30
            dark:border-red-900
            dark:text-red-100
          `,

          warning: `
            bg-amber-50
            border-amber-200
            text-amber-950
            dark:bg-amber-950/30
            dark:border-amber-900
            dark:text-amber-100
          `,

          info: `
            bg-blue-50
            border-blue-200
            text-blue-950
            dark:bg-blue-950/30
            dark:border-blue-900
            dark:text-blue-100
          `,

          loading: `
            bg-background
            border-border
          `,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }