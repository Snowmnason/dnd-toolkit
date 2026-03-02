/**
 * AppKernel barrel export
 * Centralized access to kernel singleton and hooks
 */
export {
    isLazyFontLoaded, lazyFonts,
    loadLazyFont, preloadAllLazyFonts,
    type LazyFontName
} from './lazy-fonts';

