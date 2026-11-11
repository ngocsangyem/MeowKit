// Code-block syntax colours drawn from the MeowKit palette (assets/design-tokens.json).
// One accent per theme — dusk on paper, sky on night — plus ink, muted and the signal greens.
// Every foreground clears 4.5:1 on the code-block ground of its mode.

type Palette = {
  name: string;
  type: 'light' | 'dark';
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  string: string;
  number: string;
  deleted: string;
};

// Shape of a Shiki theme registration; shiki itself is a transitive dependency, not one of ours.
function buildTheme(p: Palette) {
  return {
    name: p.name,
    type: p.type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.ink },
    settings: [
      { settings: { foreground: p.ink, background: p.bg } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: p.muted, fontStyle: 'italic' } },
      {
        scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.control', 'support.type.property-name.json'],
        settings: { foreground: p.accent },
      },
      {
        scope: ['entity.name.function', 'support.function', 'entity.name.tag', 'meta.tag.sgml', 'entity.name.section.markdown'],
        settings: { foreground: p.accent },
      },
      { scope: ['string', 'string.quoted', 'markup.inline.raw', 'markup.inserted'], settings: { foreground: p.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.other', 'support.constant'], settings: { foreground: p.number } },
      { scope: ['variable.parameter', 'entity.other.attribute-name', 'variable.other.property'], settings: { foreground: p.ink } },
      { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: p.muted } },
      { scope: ['markup.deleted', 'invalid'], settings: { foreground: p.deleted } },
      { scope: ['markup.heading', 'markup.bold'], settings: { foreground: p.ink, fontStyle: 'bold' } },
    ],
  };
}

export const meowkitLight = buildTheme({
  name: 'meowkit-light',
  type: 'light',
  bg: '#e0e7f0', // surface
  ink: '#131a27',
  muted: '#566178', // 4.99:1 on surface
  accent: '#26559a', // dusk, one step deeper for 5.9:1 on surface
  string: '#2a6e4c', // success family, 4.9:1 on surface
  number: '#8a530a', // warning family, 5.0:1 on surface
  deleted: '#a43a33',
});

export const meowkitDark = buildTheme({
  name: 'meowkit-dark',
  type: 'dark',
  bg: '#1b2435', // night raised
  ink: '#eef2f7',
  muted: '#9aa6bb',
  accent: '#8fb5e8', // sky
  string: '#7fc4a0',
  number: '#e3b46a',
  deleted: '#ef9a90',
});
