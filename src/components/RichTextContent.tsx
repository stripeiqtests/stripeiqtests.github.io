import DOMPurify from 'dompurify';
import { Fragment, type ReactNode } from 'react';
import { richTextCompatibilityMode } from '../lib/richTextConfig';
import { parseInlineRichText, parseRichText, type RichTextInline } from '../lib/richText';

const compatibilityTags = ['strong', 'b', 'em', 'i', 'br', 'p', 'ul', 'ol', 'li', 'hr'];

function Inline({ parts }: { parts: RichTextInline[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part.strong ? <strong>{part.text}</strong> : part.text}
    </Fragment>
  ));
}

export function RichInlineText({ children }: { children: string }) {
  return <Inline parts={parseInlineRichText(children)} />;
}

function compatibilityHtml(value: string) {
  const markdownExpanded = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return DOMPurify.sanitize(markdownExpanded, {
    ALLOWED_TAGS: compatibilityTags,
    ALLOWED_ATTR: [],
  });
}

export function RichTextContent({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  if (richTextCompatibilityMode) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: compatibilityHtml(value) }}
      />
    );
  }

  const output: ReactNode[] = [];
  let bullets: ReactNode[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    output.push(<ul key={`list-${output.length}`} className="list-disc ml-6 space-y-1">{bullets}</ul>);
    bullets = [];
  };

  for (const [index, line] of parseRichText(value).entries()) {
    if (line.kind === 'bullet') {
      bullets.push(<li key={index}><Inline parts={line.inline} /></li>);
      continue;
    }

    flushBullets();
    if (line.kind === 'separator') {
      output.push(<hr key={index} className="my-4 border-gray-300" />);
    } else if (line.kind === 'blank') {
      output.push(<br key={index} />);
    } else {
      output.push(<p key={index} className="text-gray-700"><Inline parts={line.inline} /></p>);
    }
  }
  flushBullets();

  return <div className={className}>{output}</div>;
}
