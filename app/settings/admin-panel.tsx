import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import {
  AppPage,
  Body,
  Button,
  CustomLoad,
  SubTitle,
  Switch,
  Title,
} from "@/components/ui";
import { useNavigate } from "@/hooks/navigation";
import { getCurrentUserProfile } from "@/hooks/storage";
import { logger } from "@/hooks/utils";
import { useScale } from "@/theme";

type FlagEntry = {
  key: string;
  title?: string;
  description: string;
  kind?: string;
};

type SettingsSection = "features" | "overrides" | "devTools" | "featureFlags";

type SettingsEntry = {
  section: SettingsSection;
  key: string;
  title?: string;
  description?: string;
  value: boolean;
};

export default function AdminPanelScreen() {
  const routeParams = useLocalSearchParams();
  const S = useScale();
  const { replace: navigateTo } = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [allSettings, setAllSettings] = useState<SettingsEntry[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [kindFilter, setKindFilter] = useState<string | "all">("all");
  const [kindToggles, setKindToggles] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("featureFlags");

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      try {
        // ⚠️ CRITICAL: Always use forceRefresh=true for admin panel
        // Admin verification MUST NOT use SecureStorage cache - ALWAYS verify with Supabase
        // Reason: Admin panel protects sensitive operations. If network fails or cache is stale,
        //         deny access rather than allowing based on stale cached admin status.
        // If network error or slow connection: throw error, don't fallback to cache
        const user = await getCurrentUserProfile(true);
        if (!mounted) return;

        if (!user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(!!user.is_admin);

        // Load all settings from config (features, overrides, devTools, featureFlags)
        try {
          const { getAppConfig } = await import("@/config");
          const { getAllFlags } = await import("@/lib/feature-flags");
          const config = getAppConfig();

          // Build all settings entries from all sections
          const allEntries: SettingsEntry[] = [];

          // Add features section
          if (config.features) {
            Object.entries(config.features).forEach(([key, value]) => {
              allEntries.push({
                section: "features",
                key,
                title: key,
                description: `Feature flag: ${key}`,
                value: !!value,
              });
            });
          }

          // Add overrides section
          if (config.overrides) {
            Object.entries(config.overrides).forEach(([key, value]) => {
              allEntries.push({
                section: "overrides",
                key,
                title: key,
                description: `Override: ${key}`,
                value: !!value,
              });
            });
          }

          // Add devTools section
          if (config.devTools) {
            Object.entries(config.devTools).forEach(([key, value]) => {
              allEntries.push({
                section: "devTools",
                key,
                title: key,
                description: `Dev tool: ${key}`,
                value: !!value,
              });
            });
          }

          setAllSettings(allEntries);

          // Load feature flags from bundled config
          const ff = getAllFlags();
          const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
            key,
            title: val.title || key,
            description: val.description,
            kind: val.kind || "free",
          }));
          setFlags(entries);
          // Initialize switches to reflect current FeatureFlags enabled state
          const initialOverrides: Record<string, boolean> = Object.create(null);
          Object.entries(ff || {}).forEach(([k, v]: any) => {
            // eslint-disable-next-line security/detect-object-injection
            initialOverrides[k] = !!v.enabled;
          });
          setOverrides(initialOverrides);
        } catch (err) {
          logger.category("ui").warn("Failed to load config", err);
          setFlags([]);
          setAllSettings([]);
        }
      } catch (err) {
        logger.category("ui").error("Admin check failed", err);
        setAuthorized(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  function toggleFlag(key: string, value: boolean) {
    // Local override stub — no server persistence implemented
    setOverrides((prev) => ({ ...prev, [key]: value }));
    logger.category("ui").info(`Toggled feature flag locally: ${key} => ${value}`);
  }

  function toggleSetting(
    section: SettingsSection,
    key: string,
    value: boolean,
  ) {
    // Local override stub — no server persistence implemented
    setOverrides((prev) => ({ ...prev, [key]: value }));
    logger.category("ui").info(`Toggled ${section} setting locally: ${key} => ${value}`);
  }

  async function toggleKind(kind: string, enabled: boolean) {
    try {
      const { toggleKind: toggleKindManager, getAllFlags } = await import("@/lib/feature-flags");
      toggleKindManager(kind as any, enabled);
      setKindToggles((prev) => ({ ...prev, [kind]: enabled }));
      // Refresh the flag list from manager
      const ff = getAllFlags();
      const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
        key,
        title: val.title || key,
        description: val.description,
        kind: val.kind || "free",
      }));
      setFlags(entries);
      // Update overrides for this kind so switches reflect the change
      const newOverrides = { ...overrides };
      entries.forEach((e) => {
        if (e.kind === kind) newOverrides[e.key] = enabled;
      });
      setOverrides(newOverrides);
    } catch (err) {
      logger.category("ui").warn("Failed to toggle kind", kind, err);
    }
  }

  const handleBack = async () => {
    let username = "user";
    try {
      const { AuthStateManager } = await import("@/lib/auth/auth-state");
      const user = await AuthStateManager.getUserData();
      if (user?.username) {
        username = encodeURIComponent(user.username);
      }
    } catch (err) {
      logger.category("ui").warn("Failed to resolve username; using default", err);
    }

    const { username: _ignored, ...rest } = routeParams || {};
    const sanitizedParams: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(rest)) {
      const normalized = Array.isArray(value) ? value[0] : value;
      if (normalized === undefined) continue;
      if (
        typeof normalized === "string" ||
        typeof normalized === "number" ||
        typeof normalized === "boolean"
      ) {
        // Only persist defined primitives to avoid undefined params downstream
        // eslint-disable-next-line security/detect-object-injection
        sanitizedParams[key] = normalized;
      }
    }

    navigateTo(
      `/settings/${username}`,
      sanitizedParams,
      ["worldId", "userRole"],
    );
  };

  if (loading) {
    return (
      <AppPage center>
        <CustomLoad size="medium" />
        <Body textType="secondary" style={{ marginTop: S.space.sm }}>
          Verifying admin access…
        </Body>
      </AppPage>
    );
  }

  if (!authorized) {
    return (
      <AppPage center>
        <Title style={{ marginBottom: S.space.xs }}>Not authorized</Title>
        <Body textType="secondary" style={{ marginBottom: S.space.md }}>
          You must be an admin to access this panel.
        </Body>
        <Button text="Back" variant="ghost" onPress={handleBack} />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <Title style={{ marginBottom: S.space.xs }}>Admin Panel</Title>
      <Body textType="secondary" style={{ marginBottom: S.space.md }}>
        Toggles are local-only stubs; server changes not implemented.
      </Body>

      {/* Section Navigation */}
      <View style={{ marginBottom: S.space.md }}>
        <Body style={{ fontWeight: "600", marginBottom: S.space.xs }}>
          Settings Sections
        </Body>
        <View
          style={{ flexDirection: "row", gap: S.space.xs, flexWrap: "wrap" }}
        >
          <Button
            variant={activeSection === "featureFlags" ? "primary" : "ghost"}
            text="Feature Flags"
            onPress={() => setActiveSection("featureFlags")}
          />
          <Button
            variant={activeSection === "features" ? "primary" : "ghost"}
            text="Features"
            onPress={() => setActiveSection("features")}
          />
          <Button
            variant={activeSection === "overrides" ? "primary" : "ghost"}
            text="Overrides"
            onPress={() => setActiveSection("overrides")}
          />
          <Button
            variant={activeSection === "devTools" ? "primary" : "ghost"}
            text="Dev Tools"
            onPress={() => setActiveSection("devTools")}
          />
        </View>
      </View>

      {/* Feature Flags Section */}
      {activeSection === "featureFlags" && (
        <>
          {flags.length === 0 && (
            <Body textType="secondary" style={{ marginBottom: S.space.md }}>
              No feature flags found.
            </Body>
          )}

          {/* Kind filters and toggles */}
          {flags.length > 0 && (
            <>
              <View style={{ marginBottom: S.space.md }}>
                <Body style={{ fontWeight: "600", marginBottom: S.space.xs }}>
                  Filter by kind
                </Body>
                <View style={{ flexDirection: "row", gap: S.space.xs }}>
                  <Button
                    variant={kindFilter === "all" ? "primary" : "ghost"}
                    text="All"
                    onPress={() => setKindFilter("all")}
                  />
                  <Button
                    variant={kindFilter === "free" ? "primary" : "ghost"}
                    text="Free"
                    onPress={() => setKindFilter("free")}
                  />
                  <Button
                    variant={kindFilter === "premium" ? "primary" : "ghost"}
                    text="Premium"
                    onPress={() => setKindFilter("premium")}
                  />
                  <Button
                    variant={kindFilter === "beta" ? "primary" : "ghost"}
                    text="Beta"
                    onPress={() => setKindFilter("beta")}
                  />
                </View>
              </View>

              <View style={{ marginBottom: S.space.md }}>
                <Body style={{ fontWeight: "600", marginBottom: S.space.xs }}>
                  Enable all by kind (local)
                </Body>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: S.space.sm,
                  }}
                >
                  <Body>Free</Body>
                  <View style={{ maxWidth: 140 }}>
                    <Switch
                      checked={!!kindToggles["free"]}
                      onChange={(v) => toggleKind("free", v)}
                    />
                  </View>
                  <Body style={{ marginLeft: S.space.xs }}>Premium</Body>
                  <View style={{ maxWidth: 140 }}>
                    <Switch
                      checked={!!kindToggles["premium"]}
                      onChange={(v) => toggleKind("premium", v)}
                    />
                  </View>
                  <Body style={{ marginLeft: S.space.xs }}>Beta</Body>
                  <View style={{ maxWidth: 140 }}>
                    <Switch
                      checked={!!kindToggles["beta"]}
                      onChange={(v) => toggleKind("beta", v)}
                    />
                  </View>
                </View>
              </View>

              {flags
                .filter((f) =>
                  kindFilter === "all" ? true : f.kind === kindFilter,
                )
                .map((flag) => (
                  <View
                    key={flag.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: S.space.md,
                      borderBottomWidth: 1,
                      borderBottomColor: "#eee",
                      gap: S.space.sm,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: S.space.sm }}>
                      <Body>{flag.title}</Body>
                      <SubTitle>{flag.kind ?? "free"}</SubTitle>
                      {flag.description ? (
                        <Body
                          style={{ color: "#666", marginTop: S.space.xs }}
                          fontSize={S.font.body1}
                        >
                          {flag.description}
                        </Body>
                      ) : null}
                    </View>
                    <View style={{ maxWidth: 140 }}>
                      <Switch
                        checked={!!overrides[flag.key]}
                        onChange={(v) => toggleFlag(flag.key, v)}
                      />
                    </View>
                  </View>
                ))}
            </>
          )}
        </>
      )}

      {/* Other Settings Sections */}
      {["features", "overrides", "devTools"].includes(activeSection) && (
        <>
          {allSettings.filter((s) => s.section === activeSection).length ===
            0 && (
            <Body textType="secondary" style={{ marginBottom: S.space.md }}>
              No settings found in this section.
            </Body>
          )}
          {allSettings
            .filter((s) => s.section === activeSection)
            .map((setting) => (
              <View
                key={`${setting.section}-${setting.key}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: S.space.md,
                  borderBottomWidth: 1,
                  borderBottomColor: "#eee",
                  gap: S.space.sm,
                }}
              >
                <View style={{ flex: 1, paddingRight: S.space.sm }}>
                  <Body>{setting.title}</Body>
                  {setting.description ? (
                    <Body
                      style={{ color: "#666", marginTop: S.space.xs }}
                      fontSize={S.font.body1}
                    >
                      {setting.description}
                    </Body>
                  ) : null}
                </View>
                <View style={{ maxWidth: 140 }}>
                  <Switch
                    checked={!!overrides[setting.key]}
                    onChange={(v) =>
                      toggleSetting(setting.section, setting.key, v)
                    }
                  />
                </View>
              </View>
            ))}
        </>
      )}
    </AppPage>
  );
}
