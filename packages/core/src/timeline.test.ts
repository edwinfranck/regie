import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleFromShots, buildRenderPlan, type Clip, clipAt, clipEnd, defaultTracks, dimsFor, type MediaRef, opacityAt, sequenceDuration, snap, splitClip, toEdl, toSrt, trimClip } from './timeline';

const clip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'a1', startSec: 2, inSec: 1, outSec: 5, volume: 1, opacity: 1, fadeInSec: 0, fadeOutSec: 0, ...over });

describe('édition', () => {
  it('coupe un clip en deux moitiés jointives', () => {
    const [a, b] = splitClip(clip(), 3)!;
    expect(clipEnd(a)).toBe(3);
    expect(b.startSec).toBe(3);
    expect(b.inSec).toBe(2);
    expect(b.outSec).toBe(5);
    expect(splitClip(clip(), 10)).toBeNull();
  });
  it('rogne le début sans dépasser le début du média', () => {
    const c = trimClip(clip(), 'start', 0);
    expect(c.inSec).toBe(0);
    expect(c.startSec).toBe(1);
  });
  it('rogne la fin sans dépasser la durée du média', () => {
    expect(trimClip(clip(), 'end', 20, 6).outSec).toBe(6);
  });
  it('aimante sur le point le plus proche', () => {
    expect(snap(4.93, [5, 2], 0.2)).toBe(5);
    expect(snap(4.5, [5], 0.2)).toBe(4.5);
  });
  it('applique les fondus à l’opacité', () => {
    const c = clip({ fadeInSec: 1, fadeOutSec: 1 });
    expect(opacityAt(c, 2.5)).toBeCloseTo(0.5);
    expect(opacityAt(c, 4)).toBe(1);
    expect(opacityAt(c, 5.5)).toBeCloseTo(0.5);
  });
  it('trouve le clip actif', () => {
    const t = { ...defaultTracks()[3], clips: [clip()] };
    expect(clipAt(t, 3)?.id).toBe('c1');
    expect(clipAt(t, 6.5)).toBeNull();
  });
});

describe('assemblage depuis le découpage', () => {
  it('pose un clip par plan, garde les trous, met les dialogues en sous-titres', () => {
    const img: MediaRef = { id: 'img', type: 'IMAGE', name: 'x', mimeType: 'image/png' };
    const vid: MediaRef = { id: 'vid', type: 'VIDEO', name: 'y', mimeType: 'video/mp4', durationSec: 5 };
    const r = assembleFromShots([
      { id: 's1', code: '1A', durationSec: 3, image: img },
      { id: 's2', code: '1B', durationSec: 4, video: vid, dialogue: 'Viens.' },
      { id: 's3', code: '1C', durationSec: 2 },
    ]);
    const v1 = r.tracks.find((t) => t.name === 'V1')!;
    expect(v1.clips.map((c) => [c.name, c.startSec, clipEnd(c)])).toEqual([
      ['1A', 0, 3],
      ['1B', 3, 7],
    ]);
    expect(r.missing).toEqual(['1C']);
    expect(r.durationSec).toBe(9);
    expect(toSrt({ tracks: r.tracks })).toContain('00:00:03,000 --> 00:00:07,000\nViens.');
  });
});

describe('exports', () => {
  it('EDL au format CMX3600', () => {
    const tracks = defaultTracks();
    tracks.find((t) => t.name === 'V1')!.clips.push(clip({ startSec: 0, inSec: 0, outSec: 2 }));
    const edl = toEdl({ id: 's', name: 'Test', fps: 24, width: 1920, height: 1080, tracks }, new Map([['a1', { id: 'a1', type: 'VIDEO', name: 'plan 1A', mimeType: 'video/mp4' }]]));
    expect(edl).toContain('001  PLAN_1A  V     C        00:00:00:00 00:00:02:00 00:00:00:00 00:00:02:00');
  });
  it('dimensions paires selon le format', () => {
    expect(dimsFor('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(dimsFor('16:9', '1280x720')).toEqual({ width: 1280, height: 720 });
  });
});

// Un vrai rendu : médias générés par FFmpeg, séquence image + vidéo + son + sous-titre.
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasFfmpeg)('rendu FFmpeg', () => {
  it('produit un MP4 de la bonne durée avec image et son', () => {
    const dir = mkdtempSync(join(tmpdir(), 'regie-render-'));
    const vid = join(dir, 'v.mp4');
    const png = join(dir, 'i.png');
    const wav = join(dir, 's.wav');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', vid]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=400x400', '-frames:v', '1', png]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2', wav]);
    const media = new Map<string, MediaRef>([
      ['v', { id: 'v', type: 'VIDEO', name: 'v', mimeType: 'video/mp4', durationSec: 3 }],
      ['i', { id: 'i', type: 'IMAGE', name: 'i', mimeType: 'image/png' }],
      ['s', { id: 's', type: 'AUDIO', name: 's', mimeType: 'audio/wav', durationSec: 2 }],
    ]);
    const tracks = defaultTracks();
    tracks.find((t) => t.name === 'V1')!.clips.push(clip({ id: 'x', assetId: 'i', startSec: 0, inSec: 0, outSec: 2, fadeInSec: 0.5 }), clip({ id: 'y', assetId: 'v', startSec: 2, inSec: 0.5, outSec: 2.5, fadeOutSec: 0.5 }));
    tracks.find((t) => t.kind === 'MUSIC')!.clips.push(clip({ id: 'z', assetId: 's', startSec: 0.5, inSec: 0, outSec: 2, volume: 0.5 }));
    tracks.find((t) => t.kind === 'SUBTITLE')!.clips.push(clip({ id: 'w', assetId: null, startSec: 0, inSec: 0, outSec: 1.5, text: 'Bonjour' }));
    const seq = { id: 's', name: 'T', fps: 24, width: 640, height: 360, tracks };
    const srt = join(dir, 'sub.srt');
    writeFileSync(srt, toSrt(seq));
    const out = join(dir, 'out.mp4');
    const plan = buildRenderPlan(seq, media, { format: 'mp4', output: out, pathOf: (id) => ({ v: vid, i: png, s: wav })[id]!, hasAudio: () => true, srtPath: srt, quality: 'draft' });
    expect(plan.durationSec).toBe(sequenceDuration(seq));
    execFileSync('ffmpeg', plan.args, { stdio: 'pipe' });
    expect(existsSync(out)).toBe(true);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', out]).toString());
    expect(Number(probe.format.duration)).toBeCloseTo(4, 0);
    expect(probe.streams.map((s: any) => s.codec_type).sort()).toEqual(['audio', 'video']);
    expect(probe.streams.find((s: any) => s.codec_type === 'video').width).toBe(640);
  }, 60_000);
});
