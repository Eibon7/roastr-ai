/**
 * Request utils - unit tests
 */

import { describe, it, expect } from 'vitest';
import { getClientIp } from '../../../src/utils/request';

describe('getClientIp', () => {
  it('usa x-forwarded-for si está presente', () => {
    const ip = getClientIp({
      headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
      socket: { remoteAddress: '5.5.5.5' }
    } as any);
    expect(ip).toBe('1.2.3.4');
  });

  it('usa socket.remoteAddress si no hay x-forwarded-for', () => {
    const ip = getClientIp({
      headers: {},
      socket: { remoteAddress: '5.5.5.5' }
    } as any);
    expect(ip).toBe('5.5.5.5');
  });

  it('retorna "unknown" si no hay headers ni socket IP', () => {
    const ip = getClientIp({
      headers: {},
      socket: { remoteAddress: undefined }
    } as any);
    expect(ip).toBe('unknown');
  });
});

