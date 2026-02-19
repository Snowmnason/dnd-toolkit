import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    AnalyticsEvent,
    AnalyticsExporter,
    dispatchEvent,
    exporterRegistry,
} from '@/lib/analytics/exporters/exporter-registry';

describe('dispatchEvent', () => {
  beforeEach(() => {
    exporterRegistry.clear();
  });

  it('calls all exporters and isolates errors', async () => {
    const ok = {
      name: 'ok',
      export: vi.fn(async () => {
        // succeed
      }),
    } as unknown as AnalyticsExporter;

    const fails = {
      name: 'fails',
      export: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as unknown as AnalyticsExporter;

    exporterRegistry.register(ok);
    exporterRegistry.register(fails);

    const event: AnalyticsEvent = {
      id: 'id-1',
      timestamp: Date.now(),
      type: 'event',
      name: 'test-event',
      properties: {},
    };

    // Should not throw even though one exporter fails
    await expect(dispatchEvent(event)).resolves.toBeUndefined();

    // ok exporter called
    expect((ok.export as any).mock.calls.length).toBe(1);
    // failing exporter called too
    expect((fails.export as any).mock.calls.length).toBe(1);
  });

  it('does not call exporters for invalid global events', async () => {
    const called = {
      name: 'c',
      export: vi.fn(async () => {}),
    } as unknown as AnalyticsExporter;

    exporterRegistry.register(called);

    const badEvent = {
      // missing id and name
      id: '',
      timestamp: -1,
      type: '',
      name: '',
      properties: {},
    } as AnalyticsEvent;

    await dispatchEvent(badEvent);

    expect((called.export as any).mock.calls.length).toBe(0);
  });
});
