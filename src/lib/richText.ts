export type RichTextInline = {
  text: string;
  strong: boolean;
};

export type RichTextLine = {
  kind: 'blank' | 'bullet' | 'paragraph' | 'separator';
  inline: RichTextInline[];
};

export function parseInlineRichText(value: string): RichTextInline[] {
  const parts: RichTextInline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ text: value.slice(cursor, index), strong: false });
    }
    parts.push({ text: match[1], strong: true });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), strong: false });
  }

  return parts.length > 0 ? parts : [{ text: value, strong: false }];
}

export function parseRichText(value: string): RichTextLine[] {
  return value.split('\n').map((line) => {
    const trimmed = line.trim();
    if (trimmed === '---') return { kind: 'separator', inline: [] };
    if (trimmed === '') return { kind: 'blank', inline: [] };
    if (trimmed.startsWith('•')) {
      return {
        kind: 'bullet',
        inline: parseInlineRichText(trimmed.slice(1).trim()),
      };
    }
    return { kind: 'paragraph', inline: parseInlineRichText(line) };
  });
}
