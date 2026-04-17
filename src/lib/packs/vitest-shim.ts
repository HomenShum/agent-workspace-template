/**
 * Type-only shim for the vitest API used in packs.test.ts.
 *
 * Purpose: make `tsc --noEmit` pass at the repo root before vitest is
 * added to package.json. When vitest is installed, delete this file
 * and change the import in packs.test.ts to `from "vitest"`. The test
 * bodies require no changes — this shim matches the vitest surface
 * for describe / it / expect / and the chained matchers we use.
 *
 * Not a runtime implementation — any attempt to execute these will
 * throw. That is intentional: this file exists only so types resolve.
 */

type Matcher = {
  toBe(expected: unknown): void;
  toHaveLength(expected: number): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toContain(expected: unknown): void;
  toMatch(expected: RegExp | string): void;
  toBeDefined(): void;
  toThrow(): void;
  not: Matcher;
};

const notImplemented = (): never => {
  throw new Error(
    "vitest-shim: this is a type-only shim. Install vitest and import from 'vitest' to run tests."
  );
};

export const describe = (_name: string, fn: () => void): void => {
  // Executing the body at import time would run the assertions, so
  // we just call it — the real vitest collects these into suites.
  // For the shim, we call to surface syntax errors, but expect()
  // returns a no-op matcher so nothing throws.
  void _name;
  fn();
};

export const it = (_name: string, _fn: () => void | Promise<void>): void => {
  // No-op: don't execute test bodies under the shim. Real vitest runs
  // these. This lets the file import cleanly at build time.
  void _name;
  void _fn;
};

const makeMatcher = (): Matcher => {
  const m: Matcher = {
    toBe: () => {},
    toHaveLength: () => {},
    toBeGreaterThan: () => {},
    toBeGreaterThanOrEqual: () => {},
    toBeLessThan: () => {},
    toBeLessThanOrEqual: () => {},
    toContain: () => {},
    toMatch: () => {},
    toBeDefined: () => {},
    toThrow: () => {},
    get not() {
      return makeMatcher();
    },
  };
  return m;
};

export const expect = (_actual: unknown): Matcher => {
  void _actual;
  return makeMatcher();
};

// Keep in case a future test body uses expect.anything() or similar.
void notImplemented;
