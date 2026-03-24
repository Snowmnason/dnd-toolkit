import { CascadeManager } from '@/system/Storage';
import { beforeEach, describe, expect, it } from 'vitest';

describe('CascadeManager', () => {
  beforeEach(() => {
    CascadeManager.reset();
  });

  it('registers and returns cascade dependencies for matching keys', () => {
    CascadeManager.registerCascade('world:*', ['members:world:*', 'notes:world:*']);

    const deps = CascadeManager.getCascadeDependencies('world:123');
    expect(deps).toContain('members:world:*');
    expect(deps).toContain('notes:world:*');
  });

  it('detects simple circular dependencies and throws', () => {
    CascadeManager.registerCascade('A:*', ['B:*']);
    expect(() => CascadeManager.registerCascade('B:*', ['A:*'])).toThrow();
  });

  it('detects 3-node circular dependency (A→B→C→A) and throws', () => {
    CascadeManager.registerCascade('A:*', ['B:*']);
    CascadeManager.registerCascade('B:*', ['C:*']);
    expect(() => CascadeManager.registerCascade('C:*', ['A:*'])).toThrow(/Circular cascade dependency/);
  });

  it('allows a valid 3-node chain without false positive (A→B→C, no cycle)', () => {
    CascadeManager.registerCascade('A:*', ['B:*']);
    CascadeManager.registerCascade('B:*', ['C:*']);
    expect(() => CascadeManager.registerCascade('C:*', ['D:*'])).not.toThrow();
  });

  it('detects self-reference (A→A) and throws', () => {
    expect(() => CascadeManager.registerCascade('A:*', ['A:*'])).toThrow(/Circular cascade dependency/);
  });

  it('detects cycle introduced via multiple children ([B, C] where C leads back)', () => {
    CascadeManager.registerCascade('A:*', ['B:*']);
    CascadeManager.registerCascade('B:*', ['C:*']);
    // Registering C→[D, A] — the A child creates C→A→B→C cycle
    expect(() => CascadeManager.registerCascade('C:*', ['D:*', 'A:*'])).toThrow(/Circular cascade dependency/);
  });
});
