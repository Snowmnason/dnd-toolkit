/**
 * AppKernel barrel export
 * Centralized access to kernel singleton and hooks
 */

export {
    AppKernel, KernelErrorCode, KernelPhase, type AppKernelState, type KernelCapabilities, type KernelError
} from './app-kernel';
export {
    isLazyFontLoaded, lazyFonts,
    loadLazyFont, preloadAllLazyFonts,
    type LazyFontName
} from './lazy-fonts';

