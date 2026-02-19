import { beforeEach, describe, expect, it } from 'vitest';

import {
    AnalyticsExporter,
    exporterRegistry
} from '@/lib/analytics/exporters/exporter-registry';

describe('ExporterRegistry', () => {
  beforeEach(() => {
    exporterRegistry.clear();
  });

  it('registers and retrieves exporters', () => {
    const mock: AnalyticsExporter = {
      name: 'mock1',
      export: async () => {},
    };

    exporterRegistry.register(mock);
    expect(exporterRegistry.isRegistered('mock1')).toBe(true);
    expect(exporterRegistry.get('mock1')).toBe(mock);
  });

  it('overwrites existing exporter with same name', () => {
    const a: AnalyticsExporter = { name: 'same', export: async () => {} };
    const b: AnalyticsExporter = { name: 'same', export: async () => {} };

    exporterRegistry.register(a);
    exporterRegistry.register(b);

    expect(exporterRegistry.getAll().length).toBe(1);
    expect(exporterRegistry.get('same')).toBe(b);
  });

  it('unregister and clear behave correctly', () => {
    const m: AnalyticsExporter = { name: 'm', export: async () => {} };
    exporterRegistry.register(m);
    exporterRegistry.unregister('m');
    expect(exporterRegistry.isRegistered('m')).toBe(false);

    exporterRegistry.register(m);
    exporterRegistry.clear();
    expect(exporterRegistry.getAll().length).toBe(0);
  });

  it('getExportersForEventType respects filters', () => {
    const all: AnalyticsExporter = { name: 'all', export: async () => {} };
    const onlyError: AnalyticsExporter = {
      name: 'err',
      requiredEvents: ['error'],
      export: async () => {},
    };

    exporterRegistry.register(all);
    exporterRegistry.register(onlyError);

    const forError = exporterRegistry.getExportersForEventType('error').map(e => e.name);
    const forPage = exporterRegistry.getExportersForEventType('pageview').map(e => e.name);

    expect(forError).toContain('all');
    expect(forError).toContain('err');
    expect(forPage).toContain('all');
    expect(forPage).not.toContain('err');
  });
});
