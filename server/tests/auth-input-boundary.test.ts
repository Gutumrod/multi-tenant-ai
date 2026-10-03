import { describe, expect, it } from 'vitest';
import { extractBearerToken } from '../src/middleware/auth.js';

describe('Phase B Authorization header boundary', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['Bearer', null],
    ['Bearer ', null],
    ['Basic token', null],
    ['Token token', null],
    ['Bearer token extra', null],
    ['Bearer\ttoken', null],
    ['Bearer token', 'token'],
    ['bearer token', 'token'],
  ])('extractBearerToken(%s) -> %s', (input, expected) => {
    expect(extractBearerToken(input)).toBe(expected);
  });
});
