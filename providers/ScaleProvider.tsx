import { getScale } from "@/hooks/ui/useScale";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dimensions } from "react-native";
import { buildSizing, type Sizing } from "../theme/ultils/sizing";

type ScaleContextValue = Sizing;
const ScaleContext = createContext<ScaleContextValue>(buildSizing(getScale()));

export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(getScale());

  useEffect(() => {
    const onChange = ({ window }: any) => {
      setScale(getScale({ width: window.width }));
    };
    const sub = Dimensions.addEventListener("change", onChange);
    return () => sub?.remove?.();
  }, []);

  // Memoize the sizing object so it only rebuilds when scale changes
  const sizing = useMemo(() => buildSizing(scale), [scale]);

  return (
    <ScaleContext.Provider value={sizing}>{children}</ScaleContext.Provider>
  );
}

/**
 * Hook to get dynamic sizing tokens that update when window resizes.
 * Returns the full S object with font, space, button, etc.
 */
export function useScale() {
  return useContext(ScaleContext);
}
