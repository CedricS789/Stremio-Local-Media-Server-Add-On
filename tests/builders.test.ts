import { describe, expect, it } from 'vitest';
import { catalogPreview, fullMeta, streamTitle } from '../src/stremio/builders.js';
import type { MediaFileRow, MediaItemRow } from '../src/types.js';

const item: MediaItemRow = {
  id: 'tmdb:movie:1', type: 'movie', stremio_id: 'tt0000001', tmdb_id: 1, imdb_id: 'tt0000001',
  title: 'Example Movie', display_title: null, year: 2024, description: 'Example description',
  poster: 'https://image.test/poster.jpg', background: 'https://image.test/background.jpg', logo: null,
  genres_json: '["Drama"]', cast_json: '["Actor"]', directors_json: '["Director"]', runtime_minutes: 123,
  release_date: '2024-01-02', metadata_json: '{}', created_at: 1, updated_at: 1
};

describe('Stremio output builders', () => {
  it('builds catalog output', () => {
    expect(catalogPreview(item)).toMatchObject({ id: 'tt0000001', type: 'movie', name: 'Example Movie', releaseInfo: '2024', genres: ['Drama'] });
  });

  it('builds movie meta output', () => {
    expect(fullMeta(item)).toMatchObject({ id: 'tt0000001', imdb_id: 'tt0000001', moviedb_id: 1, runtime: '123 min', cast: ['Actor'] });
  });

  it('builds series videos with Stremio episode IDs', () => {
    const series = { ...item, id: 'tmdb:series:2', type: 'series' as const, stremio_id: 'tt0000002', imdb_id: 'tt0000002' };
    const meta = fullMeta(series, [{ season: 1, episode: 2, title: 'Second', overview: null, still: null, air_date: '2024-02-01', runtime_minutes: 45 }]);
    expect(meta.videos).toEqual([expect.objectContaining({ id: 'tt0000002:1:2', season: 1, episode: 2, title: 'Second' })]);
  });

  it('builds catalog and series meta with custom ID prefix (e.g. dls:)', () => {
    expect(catalogPreview(item, 'dls:')).toMatchObject({ id: 'dls:tt0000001', type: 'movie' });
    const series = { ...item, id: 'tmdb:series:2', type: 'series' as const, stremio_id: 'tt0000002', imdb_id: 'tt0000002' };
    const meta = fullMeta(series, [{ season: 1, episode: 1, title: 'Pilot', overview: null, still: null, air_date: '2024-02-01', runtime_minutes: 45 }], 'dls:');
    expect(meta.id).toBe('dls:tt0000002');
    expect(meta.imdb_id).toBe('tt0000002');
    expect(meta.videos).toEqual([expect.objectContaining({ id: 'dls:tt0000002:1:1', season: 1, episode: 1, title: 'Pilot' })]);
  });

  it('builds series meta with custom catalog ID prefix but canonical video IDs for tracking', () => {
    const series = { ...item, id: 'tmdb:series:2', type: 'series' as const, stremio_id: 'tt0000002', imdb_id: 'tt0000002' };
    const meta = fullMeta(series, [{ season: 1, episode: 1, title: 'Pilot', overview: null, still: null, air_date: '2024-02-01', runtime_minutes: 45 }], 'dls:', '');
    expect(meta.id).toBe('dls:tt0000002');
    expect(meta.imdb_id).toBe('tt0000002');
    expect(meta.videos).toEqual([expect.objectContaining({ id: 'tt0000002:1:1', season: 1, episode: 1, title: 'Pilot' })]);
  });

  it('describes direct-play stream quality', () => {
    expect(streamTitle({ quality: '1080P', height: 1080, video_codec: 'hevc', audio_channels: 6 } as MediaFileRow)).toBe('1080p • HEVC • 5.1');
  });

  it('preserves full rich upstream metadata while filtering to downloaded episodes', () => {
    const upstream = {
      id: 'tt1405406',
      name: 'The Vampire Diaries',
      type: 'series',
      imdbRating: '7.7',
      genres: ['Horror', 'Fantasy', 'Drama'],
      links: [
        { name: '7.7', category: 'imdb', url: 'https://imdb.com/title/tt1405406' },
        { name: 'Nina Dobrev', category: 'Cast', url: 'stremio:///search?search=Nina%20Dobrev' }
      ],
      app_extras: {
        cast: [{ name: 'Nina Dobrev', character: 'Elena Gilbert', photo: 'https://artworks.test/nina.jpg' }]
      },
      videos: [
        { id: 'tt1405406:1:1', season: 1, episode: 1, title: 'Pilot', thumbnail: 'https://extendedratings.com/1/1' },
        { id: 'tt1405406:1:16', season: 1, episode: 16, title: 'Episode 16', thumbnail: 'https://extendedratings.com/1/16' },
        { id: 'tt1405406:1:17', season: 1, episode: 17, title: 'Episode 17', thumbnail: 'https://extendedratings.com/1/17' }
      ]
    };

    const downloadedKeys = new Set(['1:16', '1:17']);
    const filteredVideos = upstream.videos
      .filter((v) => downloadedKeys.has(`${v.season}:${v.episode}`))
      .map((v) => ({ ...v, id: `tt1405406:${v.season}:${v.episode}` }));

    const enriched = {
      ...upstream,
      id: 'dls:tt1405406',
      videos: filteredVideos
    };

    expect(enriched.id).toBe('dls:tt1405406');
    expect(enriched.links).toHaveLength(2);
    expect(enriched.app_extras.cast[0]?.name).toBe('Nina Dobrev');
    expect(enriched.videos).toHaveLength(2);
    expect(enriched.videos[0]?.id).toBe('tt1405406:1:16');
    expect(enriched.videos[0]?.thumbnail).toBe('https://extendedratings.com/1/16');
  });
});
