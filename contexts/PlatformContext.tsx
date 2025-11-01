import React, { createContext, ReactNode, useContext } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

interface PlatformContextType {
  isMobile: boolean
  isDesktop: boolean
  width: number
  height: number
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined)

interface PlatformProviderProps {
  children: ReactNode
}

export function PlatformProvider({ children }: PlatformProviderProps) {
  const { width, height } = useWindowDimensions()
  const isMobile = Platform.OS === 'ios' || Platform.OS === 'android'
  const isDesktop = !isMobile && width >= 900

  const value: PlatformContextType = {
    isMobile,
    isDesktop,
    width,
    height,
  }

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const context = useContext(PlatformContext)
  if (context === undefined) {
    throw new Error('usePlatform must be used within a PlatformProvider')
  }
  return context
}
