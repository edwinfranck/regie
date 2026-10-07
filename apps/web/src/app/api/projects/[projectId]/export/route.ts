import { cameraFr, parseFountain } from '@regie/core';
import { prisma } from '@regie/db';
import { getObject } from '@regie/storage';
import { zipSync } from 'fflate';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { api, project, rateLimit } from '@/lib/api';
import { screenplayDocx, screenplayFdx } from './screenplay-formats';

// Export : scénario (Fountain, TXT, PDF, DOCX, Final Draft), projet complet (JSON), liste des
// plans (CSV), storyboard (PDF), assets (ZIP).
type P = { projectId: string };

const file = (body: BodyInit, type: string, name: string) =>
  new Response(body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]+/g, '_')}"` } });

export const GET = api<P>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  await rateLimit(`export:${user.id}`, 30, 60);
  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const p = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, include: { script: true, concept: true } });
  const base = p.slug;

  switch (format) {
    case 'fountain':
      return file(`Title: ${p.title}\n\n${p.script?.fountain ?? ''}`, 'text/plain; charset=utf-8', `${base}.fountain`);
    case 'txt':
      return file(parseFountain(p.script?.fountain ?? '').map((e) => (e.type === 'scene_heading' || e.type === 'character' || e.type === 'transition' ? e.text.toUpperCase() : e.text)).join('\n\n'), 'text/plain; charset=utf-8', `${base}.txt`);
    case 'pdf':
      return file(await screenplayPdf(p.title, p.script?.fountain ?? ''), 'application/pdf', `${base}-scenario.pdf`);
    case 'docx':
      return file(new Uint8Array(await screenplayDocx(p.title, p.script?.fountain ?? '')), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${base}-scenario.docx`);
    case 'fdx':
      return file(screenplayFdx(p.title, p.script?.fountain ?? ''), 'application/xml; charset=utf-8', `${base}.fdx`);
    case 'csv': {
      const shots = await prisma.shot.findMany({ where: { projectId: p.id }, orderBy: [{ scene: { order: 'asc' } }, { order: 'asc' }], include: { scene: true, location: true, characters: { include: { character: true } } } });
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [
        ['scène', 'plan', 'durée (s)', 'cadre', 'lieu', 'personnages', 'action', 'dialogue', 'transition', 'statut'],
        ...shots.map((s) => [s.scene.number, s.code, s.durationSec, cameraFr({ size: s.size, angle: s.angle, lens: s.lens, move: s.move }), s.location?.name ?? '', s.characters.map((c) => c.character.code).join(' '), s.action, s.dialogue ?? '', s.transition ?? '', s.status]),
      ];
      return file('﻿' + rows.map((r) => r.map(esc).join(';')).join('\n'), 'text/csv; charset=utf-8', `${base}-plans.csv`);
    }
    case 'storyboard':
      return file(await storyboardPdf(p.id, p.title, p.aspectRatio), 'application/pdf', `${base}-storyboard.pdf`);
    case 'assets': {
      const ids = req.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean);
      const assets = await prisma.asset.findMany({ where: { projectId: p.id, ...(ids?.length ? { id: { in: ids.slice(0, 500) } } : {}), ...(req.nextUrl.searchParams.get('type') ? { type: req.nextUrl.searchParams.get('type') as any } : {}) }, take: 500 });
      const entries: Record<string, Uint8Array> = {};
      for (const a of assets) {
        const ext = a.storageKey.split('.').pop();
        entries[`${a.type.toLowerCase()}/${a.name.replace(/[^\w.-]+/g, '_')}-${a.id.slice(-5)}.${ext}`] = new Uint8Array(await getObject(a.storageKey));
      }
      return file(Buffer.from(zipSync(entries, { level: 0 })), 'application/zip', `${base}-assets.zip`);
    }
    default: {
      const full = await prisma.project.findUniqueOrThrow({
        where: { id: p.id },
        include: { concept: true, story: { include: { beats: true } }, world: true, script: true, characters: true, locations: true, props: true, styles: true, lights: true, acts: true, sequences: true, scenes: { include: { characters: true } }, shots: { include: { characters: true, props: true } }, storyboards: { include: { frames: true } } },
      });
      return file(JSON.stringify({ format: 'regie/2', exportedAt: new Date().toISOString(), project: full }, null, 2), 'application/json', `${base}.json`);
    }
  }
});

// Mise en page scénario standard : Courier 12, marges américaines.
async function screenplayPdf(title: string, fountain: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const W = 612, H = 792, size = 12, lh = 12, charW = font.widthOfTextAtSize('M', size);
  const layout: Record<string, [number, number]> = { scene_heading: [108, 60], action: [108, 60], character: [266, 38], parenthetical: [223, 28], dialogue: [180, 35], transition: [432, 20], centered: [108, 60], note: [108, 60] };
  let page = doc.addPage([W, H]);
  let y = H - 72;
  let n = 1;
  const newPage = () => {
    page = doc.addPage([W, H]);
    n++;
    page.drawText(`${n}.`, { x: W - 72 - charW * 3, y: H - 48, size, font });
    y = H - 72;
  };
  page.drawText(title.toUpperCase(), { x: (W - bold.widthOfTextAtSize(title.toUpperCase(), size)) / 2, y: H / 2, size, font: bold });
  newPage();
  n = 1;
  const wrap = (text: string, cols: number) => text.split('\n').flatMap((line) => {
    const out: string[] = [];
    let cur = '';
    for (const w of line.split(/\s+/)) {
      if ((cur + ' ' + w).trim().length > cols) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    out.push(cur);
    return out;
  });
  for (const el of parseFountain(fountain)) {
    if (el.type === 'page_break') { newPage(); continue; }
    const [x, cols] = layout[el.type] ?? layout.action;
    const upper = ['scene_heading', 'character', 'transition'].includes(el.type);
    const lines = wrap(upper ? el.text.toUpperCase() : el.text.replace(/[^\x20-\x7E -ÿ\n]/g, '?'), cols);
    const gap = ['scene_heading', 'action', 'character', 'transition', 'centered'].includes(el.type) ? lh : 0;
    if (y - gap - lines.length * lh < 72) newPage(); else y -= gap;
    for (const l of lines) {
      const f = el.type === 'scene_heading' ? bold : font;
      const safe = l.replace(/[^\x20-\x7E -ÿ]/g, '?');
      const tx = el.type === 'transition' ? W - 72 - f.widthOfTextAtSize(safe, size) : el.type === 'centered' ? (W - f.widthOfTextAtSize(safe, size)) / 2 : x;
      page.drawText(safe, { x: tx, y, size, font: f, color: el.type === 'note' ? rgb(0.4, 0.4, 0.4) : rgb(0, 0, 0) });
      y -= lh;
    }
  }
  return Buffer.from(await doc.save());
}

// Storyboard : trois cases par ligne, plan, cadre et action sous l'image.
async function storyboardPdf(projectId: string, title: string, ratio: string) {
  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    include: { shots: { orderBy: { order: 'asc' }, include: { frameAsset: true, assetLinks: { where: { asset: { type: 'IMAGE' } }, include: { asset: true }, orderBy: { asset: { createdAt: 'desc' } }, take: 1 } } } },
  });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36, cols = 3, gap = 18;
  const cw = (W - 2 * M - (cols - 1) * gap) / cols;
  const [rw, rh] = ratio.split(':').map(Number);
  const ch = Math.min(cw * ((rh || 9) / (rw || 16)), 220);
  const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?');
  let page = doc.addPage([W, H]);
  let i = 0;
  page.drawText(safe(title), { x: M, y: H - M, size: 14, font: bold });
  for (const sc of scenes) {
    for (const sh of sc.shots) {
      const slot = i % 6;
      if (i > 0 && slot === 0) page = doc.addPage([W, H]);
      const col = slot % cols, row = Math.floor(slot / cols);
      const x = M + col * (cw + gap);
      const top = H - M - 28 - row * (ch + 80);
      page.drawRectangle({ x, y: top - ch, width: cw, height: ch, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.8 });
      const asset = sh.frameAsset ?? sh.assetLinks[0]?.asset;
      if (asset && /png|jpeg/.test(asset.mimeType)) {
        try {
          const bytes = await getObject(asset.storageKey);
          const img = asset.mimeType.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const s = Math.min(cw / img.width, ch / img.height);
          page.drawImage(img, { x: x + (cw - img.width * s) / 2, y: top - ch + (ch - img.height * s) / 2, width: img.width * s, height: img.height * s });
        } catch {}
      }
      page.drawText(safe(`${sh.code}  ·  ${sh.durationSec}s  ·  ${cameraFr({ size: sh.size, angle: sh.angle, lens: sh.lens, move: sh.move })}`), { x, y: top - ch - 14, size: 9, font: bold });
      const text = safe(sh.action || sh.description);
      const words = text.split(' ');
      let line = '', ly = top - ch - 28;
      for (const w of words) {
        if (font.widthOfTextAtSize(line + ' ' + w, 8.5) > cw) { page.drawText(line, { x, y: ly, size: 8.5, font }); ly -= 11; line = w; if (ly < top - ch - 70) break; } else line = (line + ' ' + w).trim();
      }
      if (ly >= top - ch - 70) page.drawText(line, { x, y: ly, size: 8.5, font });
      i++;
    }
  }
  return Buffer.from(await doc.save());
}
