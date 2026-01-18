import { logger } from "@/lib/utils/logger";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, useWindowDimensions } from "react-native";

interface PlatformContextType {
  isMobile: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

const PlatformContext = createContext<PlatformContextType | undefined>(
  undefined
);

interface PlatformProviderProps {
  children: ReactNode;
}

export function PlatformProvider({ children }: PlatformProviderProps) {
  const { width, height } = useWindowDimensions();
  // Treat native iOS/Android as mobile always. On web, consider small viewport or mobile UA as mobile.
  const MOBILE_BREAKPOINT = 900;
  const DESKTOP_BREAKPOINT = 1000;
  const HYSTERESIS = 20; // Prevent flipping near breakpoint due to scrollbar width changes

  const [isMobileState, setIsMobileState] = useState<boolean | null>(null);
  const lastWidthRef = useRef<number | null>(null);

  const isNativeMobile = Platform.OS === "ios" || Platform.OS === "android";
  const isWeb = Platform.OS === "web";
  const isSmallViewport = width < MOBILE_BREAKPOINT;

  // Guard UA access for non-web. Basic, fast mobile UA check for web.
  let isMobileUA = false;
  if (isWeb) {
    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Mobi/i.test(ua);
  }

  // Compute raw mobile state
  const rawIsMobile =
    isNativeMobile || (isWeb && (isSmallViewport || isMobileUA));

  // Apply hysteresis: only change if difference is greater than threshold
  useEffect(() => {
    if (isMobileState === null) {
      // Initial set
      setIsMobileState(rawIsMobile);
      lastWidthRef.current = width;
      logger
        .category("ui")
        .debug(
          `PlatformContext: initial platform detected - mobile=${rawIsMobile}, platform=${Platform.OS}, ${width}x${height}`
        );
    } else if (lastWidthRef.current !== null) {
      const widthDiff = Math.abs(width - lastWidthRef.current);
      // Only update if width change is significant (> HYSTERESIS px), avoiding scrollbar flips
      if (widthDiff > HYSTERESIS) {
        if (rawIsMobile !== isMobileState) {
          logger
            .category("ui")
            .debug(
              `PlatformContext: platform changed - ${isMobileState ? "mobile" : "desktop"} -> ${rawIsMobile ? "mobile" : "desktop"} (${widthDiff}px diff, new width: ${width})`
            );
          setIsMobileState(rawIsMobile);
        }
        lastWidthRef.current = width;
      }
    }
  }, [width, rawIsMobile, isMobileState]);

  const isMobile = isMobileState !== null ? isMobileState : rawIsMobile;
  const isDesktop = !isMobile && width >= DESKTOP_BREAKPOINT;

  const value: PlatformContextType = React.useMemo(
    () => ({
      isMobile,
      isDesktop,
      width,
      height,
    }),
    [isMobile, isDesktop, width, height]
  );

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return context;
}
