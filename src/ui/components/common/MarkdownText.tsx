import React from 'react';
import { RGBA, SyntaxStyle } from '@opentui/core';
import { theme } from '../../theme';

export interface MarkdownTextProps {
  content: string;
  maxCodeHeight?: number;
}

interface ParsedBlock {
  type: 'text' | 'code' | 'heading' | 'list' | 'blockquote';
  content: string;
  language?: string;
  level?: number;
}

function parseMarkdown(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (fenced)
    if (line?.startsWith('```')) {
      const language = line.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n'), language });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line?.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        content: headingMatch[2] ?? '',
        level: headingMatch[1]?.length ?? 1,
      });
      i++;
      continue;
    }

    // List item
    if (line?.match(/^[-*+]\s+/)) {
      blocks.push({
        type: 'list',
        content: line.replace(/^[-*+]\s+/, ''),
      });
      i++;
      continue;
    }

    // Numbered list
    if (line?.match(/^\d+\.\s+/)) {
      blocks.push({
        type: 'list',
        content: line.replace(/^\d+\.\s+/, ''),
      });
      i++;
      continue;
    }

    // Blockquote
    if (line?.startsWith('> ')) {
      blocks.push({
        type: 'blockquote',
        content: line.slice(2),
      });
      i++;
      continue;
    }

    // Regular text (collect consecutive lines)
    const textLines: string[] = [];
    while (
      i < lines.length &&
      lines[i] !== undefined &&
      !lines[i]?.startsWith('```') &&
      !lines[i]?.match(/^#{1,6}\s+/) &&
      !lines[i]?.match(/^[-*+]\s+/) &&
      !lines[i]?.match(/^\d+\.\s+/) &&
      !lines[i]?.startsWith('> ')
    ) {
      textLines.push(lines[i] ?? '');
      i++;
    }

    if (textLines.length > 0) {
      const textContent = textLines.join('\n').trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent });
      }
    }
  }

  return blocks;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text** or __text__
    const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)\2(.*)$/s);
    if (boldMatch) {
      if (boldMatch[1]) {
        nodes.push(<span key={key++}>{renderInlineCode(boldMatch[1])}</span>);
      }
      nodes.push(
        <strong key={key++} fg={theme.text}>
          {renderInlineCode(boldMatch[3] ?? '')}
        </strong>
      );
      remaining = boldMatch[4] ?? '';
      continue;
    }

    // Italic *text* or _text_
    const italicMatch = remaining.match(/^(.*?)(\*|_)(.+?)\2(.*)$/s);
    if (italicMatch && !italicMatch[1]?.endsWith('*') && !italicMatch[1]?.endsWith('_')) {
      if (italicMatch[1]) {
        nodes.push(<span key={key++}>{renderInlineCode(italicMatch[1])}</span>);
      }
      nodes.push(
        <em key={key++} fg={theme.textMuted}>
          {renderInlineCode(italicMatch[3] ?? '')}
        </em>
      );
      remaining = italicMatch[4] ?? '';
      continue;
    }

    // No more formatting, render the rest with inline code support
    nodes.push(<span key={key++}>{renderInlineCode(remaining)}</span>);
    break;
  }

  return nodes;
}

function renderInlineCode(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const parts = text.split(/(`[^`]+`)/);
  let key = 0;

  for (const part of parts) {
    if (part.startsWith('`') && part.endsWith('`')) {
      nodes.push(
        <span key={key++} fg={theme.accent} bg={theme.backgroundElement}>
          {part.slice(1, -1)}
        </span>
      );
    } else if (part) {
      nodes.push(<span key={key++}>{part}</span>);
    }
  }

  return nodes;
}

function getSyntaxStyle(): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    keyword: { fg: RGBA.fromHex(theme.accent), bold: true },
    string: { fg: RGBA.fromHex(theme.success) },
    comment: { fg: RGBA.fromHex(theme.textMuted), italic: true },
    number: { fg: RGBA.fromHex(theme.warning) },
    function: { fg: RGBA.fromHex(theme.info) },
    type: { fg: RGBA.fromHex(theme.secondary) },
    variable: { fg: RGBA.fromHex(theme.text) },
    operator: { fg: RGBA.fromHex(theme.primary) },
    default: { fg: RGBA.fromHex(theme.text) },
  });
}

function mapLanguageToFiletype(lang: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
  };
  return map[lang.toLowerCase()] ?? lang.toLowerCase();
}

export function MarkdownText({ content, maxCodeHeight = 10 }: MarkdownTextProps): React.ReactNode {
  const blocks = parseMarkdown(content);
  const syntaxStyle = getSyntaxStyle();

  return (
    <box style={{ flexDirection: 'column', gap: 1 }}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const headingColors: Record<number, string> = {
              1: theme.primary,
              2: theme.secondary,
              3: theme.accent,
            };
            const color = headingColors[block.level ?? 1] ?? theme.text;
            const prefix = block.level === 1 ? '# ' : block.level === 2 ? '## ' : '### ';
            return (
              <text key={idx} fg={color}>
                <strong>{prefix}{block.content}</strong>
              </text>
            );
          }

          case 'code': {
            const filetype = mapLanguageToFiletype(block.language ?? 'text');
            const lineCount = block.content.split('\n').length;
            const height = Math.min(lineCount + 1, maxCodeHeight);

            return (
              <box
                key={idx}
                style={{
                  border: true,
                  borderStyle: 'single',
                  borderColor: theme.borderSubtle,
                  backgroundColor: theme.backgroundElement,
                  height,
                  marginTop: 1,
                }}
              >
                <code
                  content={block.content}
                  filetype={filetype}
                  syntaxStyle={syntaxStyle}
                />
              </box>
            );
          }

          case 'list':
            return (
              <box key={idx} style={{ flexDirection: 'row' }}>
                <text fg={theme.accent}>  • </text>
                <text fg={theme.text}>{renderInlineFormatting(block.content)}</text>
              </box>
            );

          case 'blockquote':
            return (
              <box key={idx} style={{ flexDirection: 'row' }}>
                <text fg={theme.borderActive}>│ </text>
                <text fg={theme.textMuted}>{renderInlineFormatting(block.content)}</text>
              </box>
            );

          case 'text':
          default:
            return (
              <text key={idx} fg={theme.text}>
                {renderInlineFormatting(block.content)}
              </text>
            );
        }
      })}
    </box>
  );
}
