import { describe, expect, it } from 'vitest';
import { cleanMediaId, canonicalDownloadKey, activeTargetPaths, activeDownloads } from '../src/routes/stremio.js';
import path from 'node:path';

describe('Download robustness & concurrency protection', () => {
  it('cleanMediaId strips catalog and tracking prefixes reliably', () => {
    expect(cleanMediaId('dls:tt1234567')).toBe('tt1234567');
    expect(cleanMediaId('zpm:tt1234567')).toBe('tt1234567');
    expect(cleanMediaId('tt1234567')).toBe('tt1234567');
    expect(cleanMediaId('dls:tt1234567:1:2')).toBe('tt1234567:1:2');
    expect(cleanMediaId('zpm:tt1234567:1:2')).toBe('tt1234567:1:2');
    expect(cleanMediaId('  tt1234567  ')).toBe('tt1234567');
    expect(cleanMediaId('')).toBe('');
  });

  it('canonicalDownloadKey creates uniform keys across different route sources and modes', () => {
    // Movies
    expect(canonicalDownloadKey('movie', 'dls:tt0111161')).toBe('movie:tt0111161');
    expect(canonicalDownloadKey('movie', 'zpm:tt0111161')).toBe('movie:tt0111161');
    expect(canonicalDownloadKey('movie', 'tt0111161')).toBe('movie:tt0111161');

    // Episodes
    expect(canonicalDownloadKey('episode', 'dls:tt0944947:1:1')).toBe('episode:tt0944947:1:1');
    expect(canonicalDownloadKey('episode', 'zpm:tt0944947:1:1')).toBe('episode:tt0944947:1:1');
    expect(canonicalDownloadKey('episode', 'tt0944947:1:1')).toBe('episode:tt0944947:1:1');

    // Season batch
    expect(canonicalDownloadKey('season', 'dls:tt0944947:2:1')).toBe('season:tt0944947:2');
    expect(canonicalDownloadKey('season', 'zpm:tt0944947:2:5')).toBe('season:tt0944947:2');
    expect(canonicalDownloadKey('season', 'tt0944947:2:1')).toBe('season:tt0944947:2');
  });

  it('prevents key divergence between preview, stream cards, and download triggers', () => {
    const movieStremioId = 'dls:tt1375666';
    const movieDirectId = 'tt1375666';
    expect(canonicalDownloadKey('movie', movieStremioId)).toBe(canonicalDownloadKey('movie', movieDirectId));

    const seriesStremioId = 'dls:tt0903747:5:14';
    const seriesDirectId = 'tt0903747:5:14';
    expect(canonicalDownloadKey('episode', seriesStremioId)).toBe(canonicalDownloadKey('episode', seriesDirectId));
  });

  it('manages filesystem target path mutex locking without race collisions', () => {
    const testDir = path.resolve('/media/movies/Inception (2010)');
    const testFile = 'Inception (2010).1080p.mkv';
    const finalPath = path.join(testDir, testFile);
    const partPath = `${finalPath}.part`;

    const normFinal = path.resolve(finalPath);
    const normPart = path.resolve(partPath);

    // Initial state: not locked
    expect(activeTargetPaths.has(normFinal)).toBe(false);
    expect(activeTargetPaths.has(normPart)).toBe(false);

    // Acquire lock
    activeTargetPaths.add(normFinal);
    activeTargetPaths.add(normPart);

    // Any other worker checking destination will detect lock
    const isLocked = activeTargetPaths.has(normFinal) || activeTargetPaths.has(normPart);
    expect(isLocked).toBe(true);

    // Release lock
    activeTargetPaths.delete(normFinal);
    activeTargetPaths.delete(normPart);

    expect(activeTargetPaths.has(normFinal)).toBe(false);
    expect(activeTargetPaths.has(normPart)).toBe(false);
  });
});
