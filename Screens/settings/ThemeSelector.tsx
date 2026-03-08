import { Button } from "@/components/ui";
import { useNavigate } from "@/hooks/navigation";
import { usePlatform } from "@/providers";
import {
  $,
  allThemes,
  ThemeFamily,
  ThemeMode,
  useScale,
  UseTheme,
} from "@/theme";
import { useSegments } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

/**
 * 🎨 ThemeSelector
 * Displays a grid of theme families with light/dark swatches.
 */
export function ThemeSelector() {
  const { setTheme, mode, setMode, family: activeTheme } = UseTheme();
  const changeTheme = (themeName: ThemeFamily) => setTheme(themeName, mode);
  const toggleMode = () => setMode(mode === 'light' ? 'dark' : 'light');
  const { isMobile } = usePlatform();
  const { theme: currentTheme } = UseTheme();
  const S = useScale();
  const { push: navigatePush } = useNavigate();
  const segments = useSegments();

  // Check if we're already on the StyleMobile or StyleDesktop routes
  const isOnStylePage =
    (segments as string[]).includes("StyleMobile") ||
    (segments as string[]).includes("StyleDesktop");

  const handleSelect = (themeName: ThemeFamily, themeMode: ThemeMode) => {
    // Change theme family first
    changeTheme(themeName);

    // Then, ensure the mode matches
    if (mode !== themeMode) toggleMode();
  };

  return (
    <View
      style={{
        flexDirection: "column",
        alignItems: "center",
        gap: S.space.lg,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: S.space.lg,
        }}
      >
        {Object.entries(allThemes).map(([key, theme]) => {
          const themeKey = key as ThemeFamily;
          const isActiveFamily = themeKey === activeTheme;

          return (
            <View
              key={themeKey}
              style={{
                alignItems: "center",
                padding: S.space.sm,
              }}
            >
              {/* ─────────── Theme Name ─────────── */}
              <Text
                style={{
                  color: $("textPrimary", currentTheme),
                  fontWeight: isActiveFamily ? "bold" : "600",
                  marginBottom: S.space.sm,
                }}
              >
                {themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
              </Text>

              {/* ─────────── Light & Dark Swatches ─────────── */}
              <View style={{ flexDirection: "row", gap: S.space.sm }}>
                {(Object.keys(theme) as ThemeMode[]).map((m) => {
                  let bg = "#222";
                  switch (m) {
                    case "light":
                      bg = theme.light?.background ?? "#222";
                      break;
                    case "dark":
                      bg = theme.dark?.background ?? "#222";
                      break;
                  }
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => handleSelect(themeKey, m)}
                      activeOpacity={0.85}
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: S.radius.md,
                        backgroundColor: bg,
                        borderWidth: isActiveFamily && mode === m ? 3 : 1,
                        borderColor:
                          isActiveFamily && mode === m
                            ? $("accent", currentTheme)
                            : $("border", currentTheme),
                      }}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      {!isOnStylePage && (
        <Button
          variant="secondary"
          text="Playground"
          onPress={() => {
            const targetPath = isMobile
              ? "/settings/StyleMobile"
              : "/settings/StyleDesktop";
            navigatePush(targetPath);
          }}
          style={{ alignSelf: "center" }}
        />
      )}
    </View>
  );
}
