import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { getCurrentUserProfile } from '../../lib/database/common';
import { logger } from '../../lib/utils/logger';

type FlagEntry = {
  key: string;
  title: string;
  description?: string;
  kind?: string;
};

export default function AdminPanelScreen({ navigation }: any) {
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

        setAuthorized(!!(user as any).admin);

        // Load feature flags from bundled config
        try {
          // Dynamic import so bundlers handle JSON correctly
          // config path relative to project root
           
            const { FeatureFlags } = await import('../../lib/feature-flags');
            const ff = FeatureFlags.getAllFlags();
          const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
            key,
            title: val.title || key,
            description: val.description,
            kind: val.kind || 'free'
          }));
          setFlags(entries);
          // Initialize switches to reflect current FeatureFlags enabled state
          const initialOverrides: Record<string, boolean> = {};
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
    setOverrides(prev => ({ ...prev, [key]: value }));
    logger.info('admin-panel', `Toggled feature flag locally: ${key} => ${value}`);
  }

  async function toggleKind(kind: string, enabled: boolean) {
    try {
      const { FeatureFlags } = await import('../../lib/feature-flags');
      FeatureFlags.toggleKind(kind as any, enabled);
      setKindToggles(prev => ({ ...prev, [kind]: enabled }));
      // Refresh the flag list from manager
      const ff = FeatureFlags.getAllFlags();
      const entries = Object.entries(ff || {}).map(([key, val]: any) => ({
        key,
        title: val.title || key,
        description: val.description,
        kind: val.kind || 'free'
      }));
      setFlags(entries);
      // Update overrides for this kind so switches reflect the change
      const newOverrides = { ...overrides };
      entries.forEach(e => {
        if (e.kind === kind) newOverrides[e.key] = enabled;
      });
      setOverrides(newOverrides);
    } catch (err) {
      logger.warn('admin-panel', 'Failed to toggle kind', kind, err);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Verifying admin access…</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Not authorized</Text>
        <Text style={styles.hint}>You must be an admin to access this panel.</Text>
        <Button title="Back" onPress={() => navigation?.goBack?.()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>
      <Text style={styles.hint}>Toggles are local-only stubs; server changes not implemented.</Text>

      {flags.length === 0 && <Text style={styles.hint}>No feature flags found.</Text>}

      {/* Kind filters and toggles */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Filter by kind</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="All" onPress={() => setKindFilter('all')} />
          <Button title="Free" onPress={() => setKindFilter('free')} />
          <Button title="Premium" onPress={() => setKindFilter('premium')} />
          <Button title="Beta" onPress={() => setKindFilter('beta')} />
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: '600', marginBottom: 8 }}>Enable all by kind (local)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 80 }}>Free</Text>
          <Switch value={!!kindToggles['free']} onValueChange={(v) => toggleKind('free', v)} />
          <Text style={{ width: 80, marginLeft: 8 }}>Premium</Text>
          <Switch value={!!kindToggles['premium']} onValueChange={(v) => toggleKind('premium', v)} />
          <Text style={{ width: 80, marginLeft: 8 }}>Beta</Text>
          <Switch value={!!kindToggles['beta']} onValueChange={(v) => toggleKind('beta', v)} />
        </View>
      </View>

      {flags.filter(f => kindFilter === 'all' ? true : f.kind === kindFilter).map(flag => (
        <View key={flag.key} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.flagTitle}>{flag.title} <Text style={{ fontSize: 12, color: '#888' }}>({flag.kind})</Text></Text>
            {flag.description ? <Text style={styles.flagDesc}>{flag.description}</Text> : null}
          </View>
          <Switch
            value={!!overrides[flag.key]}
            onValueChange={v => toggleFlag(flag.key, v)}
          />
        </View>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8
  },
  hint: {
    color: '#666',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  rowText: {
    flex: 1,
    paddingRight: 12
  },
  flagTitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  flagDesc: {
    color: '#666'
  }
});
