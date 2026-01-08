import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppPage, Body, Button, CustomLoad, SubTitle, Switch, Title } from '@/components/ui';
import { getCurrentUserProfile } from '@/lib/database/common';
import { logger } from '@/lib/utils/logger';
import { useScale } from '@/theme';

type FlagEntry = {
  key: string;
  title?: string;
  description: string;
  kind?: string;
};

export default function AdminPanelScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const S = useScale();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [kindFilter, setKindFilter] = useState<string | 'all'>('all');
  const [kindToggles, setKindToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      try {
        // Force a fresh fetch from DB to verify admin and recache
        const user = await getCurrentUserProfile(true);
        if (!mounted) return;

        if (!user) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(!!user.isAdmin);

        // Load feature flags from bundled config
        try {
          const { FeatureFlags } = await import('@/lib/feature-flags');
          const ff = FeatureFlags.getAllFlags();
          const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
            key,
            title: val.title || key,
            description: val.description,
            kind: val.kind || 'free',
          }));
          setFlags(entries);
          // Initialize switches to reflect current FeatureFlags enabled state
          const initialOverrides: Record<string, boolean> = Object.create(null);
          Object.entries(ff || {}).forEach(([k, v]: any) => {
            initialOverrides[k] = !!v.enabled;
          });
          setOverrides(initialOverrides);
        } catch (err) {
          logger.warn('admin-panel', 'Failed to load feature flags config', err);
          setFlags([]);
        }
      } catch (err) {
        logger.error('admin-panel', 'Admin check failed', err);
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
    logger.info('admin-panel', `Toggled feature flag locally: ${key} => ${value}`);
  }

  async function toggleKind(kind: string, enabled: boolean) {
    try {
      const { FeatureFlags } = await import('@/lib/feature-flags');
      FeatureFlags.toggleKind(kind as any, enabled);
      setKindToggles((prev) => ({ ...prev, [kind]: enabled }));
      // Refresh the flag list from manager
      const ff = FeatureFlags.getAllFlags();
      const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
        key,
        title: val.title || key,
        description: val.description,
        kind: val.kind || 'free',
      }));
      setFlags(entries);
      // Update overrides for this kind so switches reflect the change
      const newOverrides = { ...overrides };
      entries.forEach((e) => {
        if (e.kind === kind) newOverrides[e.key] = enabled;
      });
      setOverrides(newOverrides);
    } catch (err) {
      logger.warn('admin-panel', 'Failed to toggle kind', kind, err);
    }
  }

  const handleBack = async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    let username = 'user';
    try {
      const { AuthStateManager } = await import('@/lib/auth-state');
      const user = await AuthStateManager.getUserData();
      if (user?.username) {
        username = encodeURIComponent(user.username);
      }
    } catch (err) {
      logger.warn('admin-panel', 'Failed to resolve username; using default', err);
    }

    const { username: _ignored, ...rest } = routeParams || {};
    const qs = Object.keys(rest).length
      ? `?${new URLSearchParams(
          Object.entries(rest).reduce<Record<string, string>>((acc, [k, v]) => {
            acc[k] = Array.isArray(v) ? v[0] ?? '' : (v ?? '').toString();
            return acc;
          }, {})
        ).toString()}`
      : '';

    router.replace(`/settings/${username}${qs}`);
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

      {flags.length === 0 && (
        <Body textType="secondary" style={{ marginBottom: S.space.md }}>
          No feature flags found.
        </Body>
      )}

      {/* Kind filters and toggles */}
      <View style={{ marginBottom: S.space.md }}>
        <Body style={{ fontWeight: '600', marginBottom: S.space.xs }}>Filter by kind</Body>
        <View style={{ flexDirection: 'row', gap: S.space.xs }}>
          <Button
            variant={kindFilter === 'all' ? 'primary' : 'ghost'}
            text="All"
            onPress={() => setKindFilter('all')}
          />
          <Button
            variant={kindFilter === 'free' ? 'primary' : 'ghost'}
            text="Free"
            onPress={() => setKindFilter('free')}
          />
          <Button
            variant={kindFilter === 'premium' ? 'primary' : 'ghost'}
            text="Premium"
            onPress={() => setKindFilter('premium')}
          />
          <Button
            variant={kindFilter === 'beta' ? 'primary' : 'ghost'}
            text="Beta"
            onPress={() => setKindFilter('beta')}
          />
        </View>
      </View>

      <View style={{ marginBottom: S.space.md }}>
        <Body style={{ fontWeight: '600', marginBottom: S.space.xs }}>Enable all by kind (local)</Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.space.sm }}>
          <Body style={{  }}>Free</Body>
          <View style={{ maxWidth: 140 }}>
            <Switch checked={!!kindToggles['free']} onChange={(v) => toggleKind('free', v)} />
          </View>
          <Body style={{  marginLeft: S.space.xs }}>Premium</Body>
          <View style={{ maxWidth: 140 }}>
            <Switch checked={!!kindToggles['premium']} onChange={(v) => toggleKind('premium', v)} />
          </View>
          <Body style={{ marginLeft: S.space.xs }}>Beta</Body>
          <View style={{ maxWidth: 140 }}>
            <Switch checked={!!kindToggles['beta']} onChange={(v) => toggleKind('beta', v)} />
          </View>
        </View>
      </View>

      {flags
        .filter((f) => (kindFilter === 'all' ? true : f.kind === kindFilter))
        .map((flag) => (
          <View
            key={flag.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: S.space.md,
              borderBottomWidth: 1,
              borderBottomColor: '#eee',
              gap: S.space.sm,
            }}
          >
            <View style={{ flex: 1, paddingRight: S.space.sm }}>
              <Body>{flag.title}</Body>
              <SubTitle>{flag.kind ?? 'free'}</SubTitle>
              {flag.description ? (
                <Body style={{ color: '#666', marginTop: S.space.xs }} fontSize={S.font.body1}>
                  {flag.description}
                </Body>
              ) : null}
            </View>
            <View style={{ maxWidth: 140 }}>
              <Switch checked={!!overrides[flag.key]} onChange={(v) => toggleFlag(flag.key, v)} />
            </View>
          </View>
        ))}
    </AppPage>
  );
}
