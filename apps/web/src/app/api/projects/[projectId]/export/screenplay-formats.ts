import { type ScriptElement, parseFountain } from '@regie/core';
import { AlignmentType, Document, Header, LineRuleType, Packer, PageNumber, Paragraph, TextRun } from 'docx';

// Scénario en Word et en Final Draft, à partir du Fountain parsé.
// Mise en page américaine standard : Letter, Courier 12, marge gauche 1,5 pouce.

const TW = 1440; // twips par pouce
const upper = (e: ScriptElement) => (['scene_heading', 'character', 'transition'].includes(e.type) ? e.text.toUpperCase() : e.text);

// Retraits (gauche, droite) en pouces, mesurés depuis les marges (texte large de 6 pouces).
const INDENT: Partial<Record<ScriptElement['type'], [number, number]>> = {
  character: [2.2, 0],
  parenthetical: [1.6, 2.4],
  dialogue: [1, 1.5],
};
// Une ligne blanche avant ces éléments, pas avant le dialogue qui suit son personnage.
const GAP_BEFORE = new Set<ScriptElement['type']>(['scene_heading', 'action', 'character', 'transition', 'centered', 'note']);

export async function screenplayDocx(title: string, fountain: string) {
  const font = 'Courier New';
  const size = 24; // demi-points : 12 pt
  const line = { line: 240, lineRule: LineRuleType.EXACT };
  const paragraphs: Paragraph[] = [];
  let pageBreak = false;

  for (const el of parseFountain(fountain)) {
    if (el.type === 'page_break') {
      pageBreak = true;
      continue;
    }
    const [left, right] = INDENT[el.type] ?? [0, 0];
    const lines = upper(el).split('\n');
    paragraphs.push(
      new Paragraph({
        pageBreakBefore: pageBreak,
        keepNext: el.type === 'scene_heading' || el.type === 'character' || el.type === 'parenthetical',
        keepLines: true,
        alignment: el.type === 'transition' ? AlignmentType.RIGHT : el.type === 'centered' ? AlignmentType.CENTER : AlignmentType.LEFT,
        indent: { left: left * TW, right: right * TW },
        spacing: { ...line, before: GAP_BEFORE.has(el.type) && paragraphs.length ? 240 : 0 },
        children: lines.map((t, i) => new TextRun({ text: t, font, size, bold: el.type === 'scene_heading', italics: el.type === 'note', break: i > 0 ? 1 : undefined })),
      }),
    );
    pageBreak = false;
  }

  const page = { size: { width: 8.5 * TW, height: 11 * TW }, margin: { top: TW, bottom: TW, left: 1.5 * TW, right: TW, header: 0.5 * TW } };
  const doc = new Document({
    title,
    creator: 'régie',
    styles: { default: { document: { run: { font, size } } } },
    sections: [
      {
        properties: { page },
        children: [
          new Paragraph({ spacing: { before: 4 * TW } }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title.toUpperCase(), font, size, bold: true })] }),
        ],
      },
      {
        properties: { page: { ...page, pageNumbers: { start: 1 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, '.'], font, size })] })] }) },
        children: paragraphs.length ? paragraphs : [new Paragraph({ children: [new TextRun({ text: '', font, size })] })],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

const FDX_TYPE: Record<ScriptElement['type'], string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  centered: 'General',
  note: 'General',
  page_break: 'General',
};

// Échappe le texte et retire les caractères de contrôle interdits en XML 1.0.
const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function screenplayFdx(title: string, fountain: string) {
  const out: string[] = [];
  let newPage = false;
  for (const el of parseFountain(fountain)) {
    if (el.type === 'page_break') {
      newPage = true;
      continue;
    }
    const attrs = [`Type="${FDX_TYPE[el.type]}"`];
    if (el.type === 'centered') attrs.push('Alignment="Center"');
    if (newPage) attrs.push('StartsNewPage="Yes"');
    newPage = false;
    const text = el.type === 'note' ? `[[${el.text}]]` : upper(el);
    // Final Draft ne rend pas les retours à la ligne dans <Text> : une ligne, un paragraphe.
    for (const [i, t] of text.split('\n').entries()) out.push(`    <Paragraph ${(i ? attrs.filter((a) => !a.startsWith('StartsNewPage')) : attrs).join(' ')}>\n      <Text>${xml(t)}</Text>\n    </Paragraph>`);
  }
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="5">',
    '  <Content>',
    ...out,
    '  </Content>',
    '  <TitlePage>',
    '    <Content>',
    `      <Paragraph Alignment="Center" Type="General">\n        <Text>${xml(title.toUpperCase())}</Text>\n      </Paragraph>`,
    '    </Content>',
    '  </TitlePage>',
    '</FinalDraft>',
    '',
  ].join('\n');
}
