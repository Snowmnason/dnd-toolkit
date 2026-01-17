/**
 * AppKernel barrel export
 * Centralized access to kernel singleton and hooks
 */

export { AppKernel, KernelPhase, type AppKernelState } from './app-kernel';
export {
    isLazyFontLoaded, lazyFonts,
    loadLazyFont, preloadAllLazyFonts,
    type LazyFontName
} from './lazy-fonts';
export { AppKernelProvider, useAppKernel, useAppReady, usePhaseReady } from './use-app-kernel';

