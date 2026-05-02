import { Button } from "@/components/ui";
import { useNavigation } from "@/hooks/navigation";
import {
  $,
  allThemes,
  ThemeFamily,
  ThemeMode,
  useScale,
  UseTheme,
} from "@/theme";
import { useSegments } from "expo-router";
import { Pressable, Text, View } from "react-native";

/**
 * 🎨 ThemeSelector
 * Displays a grid of theme families with light/dark swatches.
 */
export function ThemeSelector() {
  const { setTheme, mode, setMode, family: activeTheme } = UseTheme();
  const changeTheme = (themeName: ThemeFamily) => setTheme(themeName, mode);
  const toggleMode = () => setMode(mode === 'light' ? 'dark' : 'light');
  const { theme: currentTheme } = UseTheme();
  const S = useScale();
  const navigate = useNavigation();
  const segments = useSegments();

  // Check if we're already on the StyleMobile or StyleDesktop routes
  const isOnStylePage =
    (segments as string[]).includes("stylemobile") ||
    (segments as string[]).includes("styledesktop");

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
                    <Pressable
                      key={m}
                      onPress={() => handleSelect(themeKey, m)}
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
          onPress={() => navigate.to('style-playground')}
          style={{ alignSelf: "center" }}
        />
      )}
    </View>
  );
}
