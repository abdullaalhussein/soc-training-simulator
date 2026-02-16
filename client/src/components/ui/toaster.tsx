"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

let toastListeners: ((toast: Toast) => void)[] = []
let toastCount = 0

export function toast({ title, description, variant = "default" }: Omit<Toast, "id">) {
  const id = String(++toastCount)
  const newToast: Toast = { id, title, description, variant }
  toastListeners.forEach((listener) => listener(newToast))
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToast: Toast) => {
      setToasts((prev) => [...prev, newToast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id))
      }, 5000)
    }
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5",
            t.variant === "destructive"
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border bg-background text-foreground"
          )}
        >
          <div className="grid gap-1">
            {t.title && <p className="text-sm font-semibold">{t.title}</p>}
            {t.description && <p className="text-sm opacity-90">{t.description}</p>}
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
            className="ml-4 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
