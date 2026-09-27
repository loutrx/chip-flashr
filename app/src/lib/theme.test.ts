import { describe, expect, it } from 'vitest';
import tokens from '../styles/tokens.css?raw';
import { applyTheme, resolveTheme } from './theme';

/** Body of the first CSS block whose selector list contains `selector`. */
function block(selector: string): string {
  const start = tokens.indexOf(selector);
  expect(start, `selector ${selector} missing from tokens.css`).toBeGreaterThanOrEqual(0);
  const open = tokens.indexOf('{', start);
  return tokens.slice(open + 1, tokens.indexOf('}', open));
}

const names = (css: string) => [...css.matchAll(/(--cf-[a-z0-9-]+)\s*:/g)].map((m) => m[1]).sort();

describe('resolveTheme', () => {
  it('follows the system only when the user chose "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme on the root element', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme(root, 'light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });
});

describe('tokens.css', () => {
  it('defines every themed token for both themes', () => {
    const light = names(block(":root[data-theme='light']"));
    const dark = names(block(":root[data-theme='dark']"));
    expect(light.length).toBeGreaterThan(30);
    expect(dark).toEqual(light);
  });
});
