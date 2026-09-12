"use client"

import { createContext, useContext } from "react"

interface ToastContextType {
  toast: (message: string) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
