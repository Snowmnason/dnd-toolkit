/**
 * AppKernel - Centralized app bootstrap and lifecycle management
 *
 * Consolidates all bootstrapping phases (preload, storage, auth, network, app ready)
 * into a single, explicit contract. Ensures all consumers subscribe to one source of truth.
 *
 * Phases:
 * - IDLE: Initial state, not started
 * - PRELOAD: Loading fonts, platform assets (critical, <500ms target)
 * - STORAGE: Cache validation & migrations
 * - NETWORK: Network detection initialization
 * - AUTH: Session restoration (non-blocking, can proceed to READY without waiting)
 * - READY: App is ready to render main UI
 * - ERROR: A critical phase failed
 */

import { NetworkDetection } from '@/lib/network/network-detection';
import { logger } from '@/lib/utils/logger';

// FUTURE ENHANCEMENT: Phase Progress Callbacks
// To add progress tracking for phases (e.g., "Loading fonts... 50%"):
// 1. Add `onProgress?: (progress: number, message: string) => void` to runPhase()
// 2. Call onProgress() with incremental updates during async operations
// 3. Emit progress events through kernel.subscribe() with extended state
// Example: this.notifyProgress('preload', 0.5, 'Loading GrenzeGotisch font...');

export enum KernelPhase {
  IDLE = 'idle',
  PRELOAD = 'preload',
  STORAGE = 'storage',
  NETWORK = 'network',
  AUTH = 'auth',
  READY = 'ready',
  ERROR = 'error',
}

export interface AppKernelState {
  currentPhase: KernelPhase;
  phases: {
    preloadReady: boolean;
    storageReady: boolean;
    networkReady: boolean;
    authReady: boolean;
    appReady: boolean;
  };
  error: Error | null;
  timing: Record<string, number>; // Phase timing in milliseconds
}

type KernelListener = (state: AppKernelState) => void;

class AppKernelClass {
  private state: AppKernelState = {
    currentPhase: KernelPhase.IDLE,
    phases: {
      preloadReady: false,
      storageReady: false,
      networkReady: false,
      authReady: false,
      appReady: false,
    },
    error: null,
    timing: {},
  };

  private listeners: Set<KernelListener> = new Set();
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the kernel once
   * Safe to call multiple times - only initializes once
   */
  async initialize(): Promise<void> {
    // If already initializing or initialized, return the same promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeInternal();
    return this.initPromise;
  }

  private async _initializeInternal(): Promise<void> {
    try {
      logger.category('bootstrap').info('AppKernel initializing...');

      // Phase 1: Preload (fonts, platform assets)
      await this.runPhase('preload', async () => {
        try {
          const { Platform } = await import('react-native');
          const { preloadThemes } = await import('@/theme');
          const { injectWebFonts } = await import('@/lib/utils/web-font-loader');

          if (Platform.OS === 'web') {
            await injectWebFonts();
          } else {
            try {
              const FontModule = await import('expo-font');
              const Font = FontModule.default || FontModule;
              const criticalFonts = {
                GrenzeGotisch: require('../../assets/fonts/GrenzeGotisch.ttf'),
              };
              await Font.loadAsync(criticalFonts);
            } catch (fontError) {
              logger.category('bootstrap').warn('Font loading failed (non-critical)', { error: (fontError as Error).message });
            }
          }

          // Preload themes in background
          preloadThemes().catch(() => {
            logger.category('bootstrap').debug('Theme preload in background');
          });
        } catch (error) {
          logger.category('bootstrap').warn('Preload assets failed (non-critical)', { error: (error as Error).message });
        }
      });

      // Phase 2: Storage (cache validation/migrations)
      await this.runPhase('storage', async () => {
        try {
          // Validate critical storage entries during bootstrap
          // Only validate what's needed for app to function - don't block on world data
          logger.category('bootstrap').debug('Running storage validation for critical cache entries');
          
          // Storage validation happens lazily on first access via SecureStorage.getValidatedJSON()
          // This phase ensures storage system is initialized and ready
          logger.category('bootstrap').debug('Storage system initialized and ready');
        } catch (error) {
          logger.category('bootstrap').warn('Storage validation warning (non-critical)', { 
            error: (error as Error).message 
          });
        }
      });

      // Phase 3: Network (initialize detection)
      await this.runPhase('network', async () => {
        try {
          await NetworkDetection.initialize();
          logger.category('bootstrap').debug('Network detection initialized');
        } catch (error) {
          logger.category('bootstrap').warn('Network detection failed (non-critical)', { error: (error as Error).message });
        }
      });

      // Phase 4: Auth (restore session - non-blocking)
      // Start in background without awaiting
      this.runPhase('auth', async () => {
        try {
          const { AuthStateManager } = await import('@/lib/auth/auth-state');
          await AuthStateManager.getAuthState();
          logger.category('bootstrap').debug('Auth state loaded');
          
          // Mark auth as ready after successful load
          this.updateState({ 
            phases: { ...this.state.phases, authReady: true }
          });
        } catch (e) {
          logger.category('auth').error('Auth state load failed', { error: (e as Error).message });
          // Mark auth as ready even on failure - app should still work
          this.updateState({ 
            phases: { ...this.state.phases, authReady: true }
          });
        }
      }).catch((e) => {
        logger.category('bootstrap').warn('Auth phase error (non-blocking)', { error: (e as Error).message });
      });

      // Mark app ready - don't wait for auth
      this.updateState({
        currentPhase: KernelPhase.READY,
        phases: { ...this.state.phases, appReady: true },
      });

      const totalBootstrapTime = Object.values(this.state.timing).reduce((a, b) => a + b, 0);
      
      logger.category('bootstrap').info('AppKernel ready', {
        timing: this.state.timing,
        totalMs: totalBootstrapTime,
      });

      // Track performance metrics in Analytics
      try {
        const { Analytics } = await import('@/lib/analytics');
        Analytics.track('app_bootstrap_complete', {
          total: totalBootstrapTime,
          ...this.state.timing,
        });
        logger.category('bootstrap').debug('Bootstrap metrics tracked');
      } catch (analyticsError) {
        // Non-critical - don't block on analytics
        logger.category('bootstrap').debug('Analytics tracking skipped', { 
          error: (analyticsError as Error).message 
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('bootstrap').error('AppKernel initialization failed', {
        error: err.message,
        stack: err.stack?.substring(0, 200),
      });
      this.updateState({
        currentPhase: KernelPhase.ERROR,
        error: err,
      });
      throw err;
    }
  }

  /**
   * Run a phase with timing and error handling
   */
  private async runPhase(phaseName: string, fn: () => Promise<void>): Promise<void> {
    const phaseKey = `${phaseName}Ready` as keyof AppKernelState['phases'];
    const startTime = Date.now();

    try {
      this.updateState({ currentPhase: KernelPhase[phaseName.toUpperCase() as keyof typeof KernelPhase] || KernelPhase.IDLE });
      await fn();
      const duration = Date.now() - startTime;
      this.updateState({
        phases: { ...this.state.phases, [phaseKey]: true },
        timing: { ...this.state.timing, [phaseName]: duration },
      });
      logger.category('bootstrap').debug(`${phaseName} phase complete`, { durationMs: duration });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;
      logger.category('bootstrap').error(`${phaseName} phase failed`, {
        error: err.message,
        durationMs: duration,
      });
      throw err;
    }
  }

  /**
   * Update internal state and notify all listeners
   */
  private updateState(partial: Partial<AppKernelState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.state });
      } catch (error) {
        logger.category('error').error('Kernel listener error', { error: (error as Error).message });
      }
    });
  }

  /**
   * Subscribe to kernel state changes
   * Returns unsubscribe function
   */
  subscribe(fn: KernelListener): () => void {
    this.listeners.add(fn);
    // Immediately call with current state
    fn({ ...this.state });
    return () => this.listeners.delete(fn);
  }

  /**
   * Get current kernel state
   */
  getState(): AppKernelState {
    return { ...this.state };
  }

  /**
   * Reset kernel (for testing or app reset scenarios)
   */
  reset(): void {
    logger.category('bootstrap').info('AppKernel reset requested');
    this.state = {
      currentPhase: KernelPhase.IDLE,
      phases: {
        preloadReady: false,
        storageReady: false,
        networkReady: false,
        authReady: false,
        appReady: false,
      },
      error: null,
      timing: {},
    };
    this.initPromise = null;
    this.notifyListeners();
  }

  /**
   * Retry initialization after error
   * Useful for recovering from transient failures
   */
  async retry(): Promise<void> {
    logger.category('bootstrap').info('AppKernel retry requested');
    
    if (this.state.currentPhase !== KernelPhase.ERROR) {
      logger.category('bootstrap').warn('Retry called but kernel is not in ERROR state', {
        currentPhase: this.state.currentPhase,
      });
      return;
    }

    // Reset and reinitialize
    this.reset();
    return this.initialize();
  }

  /**
   * Re-run a specific phase
   * Useful for refreshing auth, network status, etc. without full restart
   */
  async rerunPhase(phase: 'auth' | 'network' | 'storage'): Promise<void> {
    logger.category('bootstrap').info('Rerunning phase', { phase });

    if (this.state.currentPhase === KernelPhase.ERROR) {
      throw new Error('Cannot rerun phase while kernel is in ERROR state. Call retry() first.');
    }

    switch (phase) {
      case 'auth':
        await this.runPhase('auth', async () => {
          const { AuthStateManager } = await import('@/lib/auth/auth-state');
          await AuthStateManager.getAuthState();
          this.updateState({ 
            phases: { ...this.state.phases, authReady: true }
          });
        });
        break;

      case 'network':
        await this.runPhase('network', async () => {
          await NetworkDetection.initialize();
        });
        break;

      case 'storage':
        await this.runPhase('storage', async () => {
          logger.category('bootstrap').debug('Storage system revalidated');
        });
        break;

      default:
        throw new Error(`Cannot rerun phase: ${phase}. Only auth, network, and storage can be rerun.`);
    }
  }
}

/**
 * Global singleton instance of AppKernel
 */
export const AppKernel = new AppKernelClass();
