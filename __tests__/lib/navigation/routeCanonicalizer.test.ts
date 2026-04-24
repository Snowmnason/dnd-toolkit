import {
    canonicalizePath,
    matchRoute,
    pathEquals,
    pathStartsWith,
    resolveRoute,
} from '@/lib/navigation/routeCanonicalizer';
import { describe, expect, it } from 'vitest';

describe('routeCanonicalizer', () => {
  describe('canonicalizePath()', () => {
    // ===== LOWERCASE CONVERSION =====
    it('converts uppercase to lowercase', () => {
      expect(canonicalizePath('/Main')).toBe('/main');
      expect(canonicalizePath('/WORLD-LIST')).toBe('/world-list');
      expect(canonicalizePath('/Main/World/List')).toBe('/main/world/list');
    });

    it('handles mixed case', () => {
      expect(canonicalizePath('/MaIn/WoRlD')).toBe('/main/world');
    });

    // ===== LEADING/TRAILING SLASHES =====
    it('trims leading slashes', () => {
      expect(canonicalizePath('/main')).toBe('/main');
      expect(canonicalizePath('//main')).toBe('/main');
      expect(canonicalizePath('///main')).toBe('/main');
    });

    it('trims trailing slashes', () => {
      expect(canonicalizePath('main/')).toBe('/main');
      expect(canonicalizePath('main//')).toBe('/main');
      expect(canonicalizePath('main///')).toBe('/main');
    });

    it('trims both leading and trailing slashes', () => {
      expect(canonicalizePath('/main/')).toBe('/main');
      expect(canonicalizePath('//main//')).toBe('/main');
    });

    // ===== PATH SEPARATOR NORMALIZATION =====
    it('collapses multiple consecutive slashes', () => {
      expect(canonicalizePath('/main//world')).toBe('/main/world');
      expect(canonicalizePath('/main///world')).toBe('/main/world');
      expect(canonicalizePath('main////world')).toBe('/main/world');
    });

    // ===== .. RESOLUTION =====
    it('resolves .. to parent segment', () => {
      expect(canonicalizePath('/main/world/..')).toBe('/main');
      expect(canonicalizePath('/main/world/../list')).toBe('/main/list');
    });

    it('resolves multiple .. in sequence', () => {
      expect(canonicalizePath('/a/b/c/../..')).toBe('/a');
      expect(canonicalizePath('/a/b/c/../../d')).toBe('/a/d');
    });

    it('resolves .. at root level (no effect)', () => {
      expect(canonicalizePath('/..')).toBe('/');
      expect(canonicalizePath('/../main')).toBe('/main');
    });

    it('resolves . (current directory, no effect)', () => {
      expect(canonicalizePath('/main/./world')).toBe('/main/world');
      expect(canonicalizePath('/./main')).toBe('/main');
      expect(canonicalizePath('/main/.')).toBe('/main');
    });

    it('resolves complex .. and . combinations', () => {
      expect(canonicalizePath('/main/./world/../characters')).toBe('/main/characters');
      expect(canonicalizePath('/a/b/./c/../d')).toBe('/a/b/d');
    });

    // ===== SPECIAL CASES =====
    it('returns empty string for empty input', () => {
      expect(canonicalizePath('')).toBe('');
    });

    it('returns empty string for null/undefined', () => {
      expect(canonicalizePath(null as any)).toBe('');
      expect(canonicalizePath(undefined as any)).toBe('');
    });

    it('returns slash for root path', () => {
      expect(canonicalizePath('/')).toBe('/');
    });

    it('handles non-string types gracefully', () => {
      expect(canonicalizePath(123 as any)).toBe('');
      expect(canonicalizePath({} as any)).toBe('');
    });

    // ===== COMPLEX SCENARIOS =====
    it('handles real-world route paths', () => {
      expect(canonicalizePath('/Main/World-List')).toBe('/main/world-list');
      expect(canonicalizePath('/Select/World')).toBe('/select/world');
      expect(canonicalizePath('/Main/Characters/123')).toBe('/main/characters/123');
    });

    it('preserves hyphens and special segment characters', () => {
      expect(canonicalizePath('/main/world-list')).toBe('/main/world-list');
      expect(canonicalizePath('/main/world_list')).toBe('/main/world_list');
    });

    it('handles mixed case, slashes, and .. together', () => {
      expect(canonicalizePath('/MAIN/World/../Settings')).toBe('/main/settings');
      expect(canonicalizePath('//Main//World/../Characters//')).toBe('/main/characters');
    });
  });

  describe('matchRoute()', () => {
    // ===== EXACT STRING MATCHING =====
    it('matches exact paths (case-insensitive)', () => {
      expect(matchRoute('/main', '/main')).toBe(true);
      expect(matchRoute('/Main', '/main')).toBe(true);
      expect(matchRoute('/MAIN', '/main')).toBe(true);
      expect(matchRoute('/main', '/MAIN')).toBe(true);
    });

    it('does not match different exact paths', () => {
      expect(matchRoute('/main', '/settings')).toBe(false);
      expect(matchRoute('/main/characters', '/main/world')).toBe(false);
    });

    it('matches exact nested paths (case-insensitive)', () => {
      expect(matchRoute('/Main/World/List', '/main/world/list')).toBe(true);
      expect(matchRoute('/MAIN/WORLD/LIST', '/main/world/list')).toBe(true);
    });

    // ===== GLOB PATTERN MATCHING =====
    it('matches glob patterns with single *', () => {
      expect(matchRoute('/main/world-list', '/main/*')).toBe(true);
      expect(matchRoute('/main/characters', '/main/*')).toBe(true);
      expect(matchRoute('/main/settings', '/main/*')).toBe(true);
    });

    it('glob * matches zero or more characters', () => {
      expect(matchRoute('/main', '/main/*')).toBe(false); // * needs at least next segment
      expect(matchRoute('/main/a', '/main/*')).toBe(true);
      expect(matchRoute('/main/abc123', '/main/*')).toBe(true);
    });

    it('does not match glob pattern in different base path', () => {
      expect(matchRoute('/settings/world-list', '/main/*')).toBe(false);
      expect(matchRoute('/select/characters', '/main/*')).toBe(false);
    });

    it('matches glob patterns with case-insensitivity', () => {
      expect(matchRoute('/Main/World', '/main/*')).toBe(true);
      expect(matchRoute('/MAIN/CHARACTERS', '/main/*')).toBe(true);
      expect(matchRoute('/main/WORLD', '/Main/*')).toBe(true);
    });

    it('matches multiple segments with globs', () => {
      expect(matchRoute('/main/world/123', '/main/world/*')).toBe(true);
      expect(matchRoute('/main/characters/456', '/main/characters/*')).toBe(true);
    });

    it('matches * glob expands to .* (matches any characters including /)', () => {
      // * is converted to .* in regex, so it matches multiple segments
      expect(matchRoute('/main/world', '/main/*')).toBe(true);
      expect(matchRoute('/main/a/b/c', '/main/*')).toBe(true); // .* can match a/b/c
      expect(matchRoute('/main', '/main/*')).toBe(false); // .* requires at least one character
    });

    it('glob pattern case-insensitivity preserved', () => {
      expect(matchRoute('/Main/Characters', '/MAIN/*')).toBe(true);
      expect(matchRoute('/main/characters', '/MAIN/*')).toBe(true);
    });

    // ===== SPECIAL CHARACTER ESCAPING =====
    it('escapes regex metacharacters in glob patterns', () => {
      // Pattern with . should match literal dot, not any character
      expect(matchRoute('/main/v1.0', '/main/v1.0')).toBe(true);
      expect(matchRoute('/main/v1x0', '/main/v1.0')).toBe(false);
    });

    it('handles special regex chars in paths', () => {
      // Literal match with special chars
      expect(matchRoute('/main/[test]', '/main/[test]')).toBe(true);
      expect(matchRoute('/main/test', '/main/[test]')).toBe(false);
    });

    it('escapes + ? in patterns', () => {
      expect(matchRoute('/main/v1+v2', '/main/v1+v2')).toBe(true);
      expect(matchRoute('/main/v11v2', '/main/v1+v2')).toBe(false);
    });

    // ===== REGEX PATTERN MATCHING =====
    it('matches RegExp patterns', () => {
      expect(matchRoute('/main/world', /^\/main\/\w+$/)).toBe(true);
      expect(matchRoute('/main/world-list', /^\/main\/[\w-]+$/)).toBe(true);
    });

    it('does not match RegExp patterns that do not match', () => {
      expect(matchRoute('/main', /^\/main\/\w+$/)).toBe(false);
      expect(matchRoute('/settings/world', /^\/main\/\w+$/)).toBe(false);
    });

    it('applies regex on canonicalized (lowercase) path', () => {
      // Paths are canonicalized (lowercased) before regex testing
      expect(matchRoute('/main/world', /^\/main\/world$/)).toBe(true);
      expect(matchRoute('/MAIN/WORLD', /^\/main\/world$/)).toBe(true); // Path is lowercased first
      expect(matchRoute('/main/other', /^\/main\/world$/)).toBe(false);
    });

    // ===== COMPLEX SCENARIOS =====
    it('handles mixed case and trailing slashes in glob', () => {
      expect(matchRoute('/Main/Characters', '/main/*')).toBe(true);
      expect(matchRoute('/Main/Characters/', '/main/*')).toBe(true); // Trailing slash normalized
    });

    it('glob * with .* allows matching multiple segments', () => {
      // * converts to .* which matches any characters including /
      expect(matchRoute('/main/characters/123', '/main/*')).toBe(true); // .* matches "characters/123"
      expect(matchRoute('/main/characters/123', '/main/*/*')).toBe(true);
    });
  });

  describe('resolveRoute()', () => {
    it('resolves user input to official route (case-insensitive)', () => {
      const routes = ['/main/world-list', '/main/characters', '/select/world'];
      expect(resolveRoute('/main/world-list', routes)).toBe('/main/world-list');
      expect(resolveRoute('/Main/World-List', routes)).toBe('/main/world-list');
      expect(resolveRoute('/MAIN/WORLD-LIST', routes)).toBe('/main/world-list');
    });

    it('returns undefined for unknown route', () => {
      const routes = ['/main/world-list', '/main/characters'];
      expect(resolveRoute('/main/settings', routes)).toBeUndefined();
      expect(resolveRoute('/unknown', routes)).toBeUndefined();
    });

    it('matches first route if multiple canonicalize to same value', () => {
      const routes = ['/main', '/Main', '/MAIN'];
      // All canonicalize to /main, first exact match is returned
      expect(resolveRoute('/main', routes)).toBe('/main');
      expect(resolveRoute('/MAIN', routes)).toBe('/main');
    });

    it('handles complex nested routes', () => {
      const routes = [
        '/main/world/list',
        '/main/characters/detail',
        '/select/world',
      ];
      expect(resolveRoute('/Main/World/List', routes)).toBe('/main/world/list');
      expect(resolveRoute('/SELECT/WORLD', routes)).toBe('/select/world');
    });
  });

  describe('pathEquals()', () => {
    it('compares paths case-insensitively', () => {
      expect(pathEquals('/main', '/main')).toBe(true);
      expect(pathEquals('/Main', '/main')).toBe(true);
      expect(pathEquals('/MAIN', '/main')).toBe(true);
    });

    it('returns false for different paths', () => {
      expect(pathEquals('/main', '/settings')).toBe(false);
      expect(pathEquals('/main/world', '/main/characters')).toBe(false);
    });

    it('normalizes trailing slashes before comparing', () => {
      expect(pathEquals('/main/', '/main')).toBe(true);
      expect(pathEquals('/main', '/main/')).toBe(true);
    });

    it('resolves .. in both paths before comparing', () => {
      expect(pathEquals('/main/world/..', '/main')).toBe(true);
      expect(pathEquals('/main', '/select/../main')).toBe(true);
    });
  });

  describe('pathStartsWith()', () => {
    it('checks if path starts with prefix (case-insensitive)', () => {
      expect(pathStartsWith('/main/characters/123', '/main/characters')).toBe(true);
      expect(pathStartsWith('/Main/Characters/123', '/main/characters')).toBe(true);
      expect(pathStartsWith('/MAIN/CHARACTERS/123', '/main/characters')).toBe(true);
    });

    it('returns false if path does not start with prefix', () => {
      expect(pathStartsWith('/main/characters/123', '/main/settings')).toBe(false);
      expect(pathStartsWith('/settings/world', '/main')).toBe(false);
    });

    it('handles exact path matches', () => {
      expect(pathStartsWith('/main/characters', '/main/characters')).toBe(true);
    });

    it('normalizes paths before checking prefix', () => {
      expect(pathStartsWith('/Main/Characters/123', '/MAIN/characters')).toBe(true);
      expect(pathStartsWith('/main/characters/123/', '/main/characters/')).toBe(true);
    });

    it('does not match if prefix is longer than path', () => {
      expect(pathStartsWith('/main', '/main/characters')).toBe(false);
    });
  });

  describe('stress tests (combined behaviors)', () => {
    it('handles real app route scenarios', () => {
      // Real-world scenario: case-insensitive, with params, trailing slashes
      expect(
        matchRoute('/Main/World-List/123/', '/main/world-list/*')
      ).toBe(true);

      expect(
        pathStartsWith('/Main/Characters/Edit/456', '/main/characters')
      ).toBe(true);

      expect(
        pathEquals('/Select/World/', '/select/world')
      ).toBe(true);
    });

    it('handles complex .. and . resolutions', () => {
      expect(
        canonicalizePath('/main/world/../characters/./detail')
      ).toBe('/main/characters/detail');

      expect(
        matchRoute('/Main/World/../Characters/Detail', '/main/characters/*')
      ).toBe(true);
    });

    it('edge case: deeply nested paths with multiple globs', () => {
      expect(
        matchRoute('/main/world/list/item/123', '/main/*/*/*/*')
      ).toBe(true);

      expect(
        matchRoute('/main/world/item/123', '/main/*/*/*/*')
      ).toBe(false);
    });
  });
});
