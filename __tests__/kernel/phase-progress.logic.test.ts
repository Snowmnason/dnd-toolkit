import { AppKernel } from '@/system/Kernel';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AppKernel.calculatePhaseProgress (logic)', () => {
  beforeEach(() => {
    AppKernel.reset();
  });

  it('all phases incomplete -> 0% and current phase is config', () => {
    const phases = {
      configReady: false,
      preloadReady: false,
      networkReady: false,
      storageReady: false,
      servicesReady: false,
      jobSetupReady: false,
      authReady: false,
      featureFlagsReady: false,
      registrationReady: false,
      appReady: false,
    } as const;

    // Call private method for logic verification
    (AppKernel as any).calculatePhaseProgress(phases);

    const p = AppKernel.getState().phaseProgress;
    expect(p.progressPercent).toBe(0);
    expect(p.currentPhaseIndex).toBe(0);
    expect(p.currentPhaseName).toBe('config');
    expect(p.phaseLabel).toMatch(/^0\/\d+ config\.\.\.$/);
  });

  it('two completed phases -> correct percent calculation', () => {
    const phases = {
      configReady: true,
      preloadReady: true,
      networkReady: false,
      storageReady: false,
      servicesReady: false,
      jobSetupReady: false,
      authReady: false,
      featureFlagsReady: false,
      registrationReady: false,
      appReady: false,
    } as const;

    (AppKernel as any).calculatePhaseProgress(phases);
    const p = AppKernel.getState().phaseProgress;

    const m = p.phaseLabel.match(/^(\d+)\/(\d+)/);
    expect(m).not.toBeNull();
    const total = m ? Number(m[2]) : 1;
    expect(p.progressPercent).toBe(Math.round((2 / total) * 100));
  });

  it('all phases complete -> 100% and ready state', () => {
    const phases = {
      configReady: true,
      preloadReady: true,
      networkReady: true,
      storageReady: true,
      servicesReady: true,
      jobSetupReady: true,
      authReady: true,
      featureFlagsReady: true,
      registrationReady: true,
      appReady: true,
    } as const;

    (AppKernel as any).calculatePhaseProgress(phases);
    const p = AppKernel.getState().phaseProgress;

    expect(p.progressPercent).toBe(100);
    expect(p.currentPhaseName).toBe('ready');
    expect(p.phaseLabel).toMatch(/^\d+\/\d+ ready\.\.\.$/);
  });
});
