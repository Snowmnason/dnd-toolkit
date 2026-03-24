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
});
