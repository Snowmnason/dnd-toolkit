/**
 * AppKernel barrel export
 * Centralized access to kernel singleton and hooks
 */
export {
    isLazyFontLoaded, lazyFonts,
    loadLazyFont, preloadAllLazyFonts,
    type LazyFontName
} from './lazy-fonts';

export {
    clearSafeMode,
    getKernelState,
    getSafeMode,
    initializeKernel,
    isAppReady,
    isKernelIdle,
    onAppReady,
    onKernelStateChange,
    setSafeMode,
    type AppKernelState,
    type KernelListener,
} from './kernel-manager';

