/**
 * Lightweight, dependency-free renderer for AI drafts.
 * Turns plain/markdown-ish text into readable sections (headings, lists, emphasis).
 */

import { Fragment, type ReactNode } from 'react'

/** Inline **bold**, *italic*, `code` */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  // Split on **bold**, `code`, *italic* (simple, non-nested)
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>)
    }
    const tok = m[0]
    if (tok.startsWith('**')) {
      parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('`')) {
      parts.push(<code key={key++} className="ai-inline-code">{tok.slice(1, -1)}</code>)
    } else {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  return parts.length ? parts : [text]
}

/** Detect label lines like "META TITLE:" or "H1:" */
function isLabelLine(line: string): boolean {
  return /^(META\s*TITLE|META\s*DESCRIPTION|TITLE|H1|H2|H3|FAQ|KEYWORDS?|OBJETIVO|VEREDICTO|CONCLUSI[OÓ]N|RESUMEN|RECOMENDACI[OÓ]N)\s*:/i.test(
    line.trim(),
  )
}

type Block =
  | { type: 'h'; level: 1 | 2 | 3; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'label'; label: string; value: string }
  | { type: 'hr' }
  | { type: 'code'; text: string }
  | { type: 'table'; rows: string[][] }

function parseBlocks(raw: string): Block[] {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // fenced code
    if (trimmed.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // closing fence
      blocks.push({ type: 'code', text: buf.join('\n') })
      continue
    }

    // markdown headings
    const hm = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (hm) {
      blocks.push({ type: 'h', level: hm[1].length as 1 | 2 | 3, text: hm[2].trim() })
      i++
      continue
    }

    // ALL-CAPS short headings without #
    if (
      trimmed.length < 80 &&
      /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s/·\-–—:]{2,}$/.test(trimmed) &&
      !trimmed.includes('.')
    ) {
      blocks.push({ type: 'h', level: 2, text: trimmed })
      i++
      continue
    }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // label: value
    if (isLabelLine(trimmed)) {
      const colon = trimmed.indexOf(':')
      const label = trimmed.slice(0, colon).trim()
      let value = trimmed.slice(colon + 1).trim()
      // pull following non-empty lines that aren't new blocks into value
      i++
      while (i < lines.length) {
        const n = lines[i].trim()
        if (!n) break
        if (n.startsWith('#') || n.startsWith('- ') || n.startsWith('* ') || isLabelLine(n) || /^\d+\.\s/.test(n)) break
        value = value ? `${value} ${n}` : n
        i++
      }
      blocks.push({ type: 'label', label, value })
      continue
    }

    // unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // simple markdown table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
        // skip separator |---|
        if (!row.every((c) => /^:?-+:?$/.test(c))) rows.push(row)
        i++
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }

    // paragraph (merge consecutive lines)
    const para: string[] = [trimmed]
    i++
    while (i < lines.length) {
      const n = lines[i].trim()
      if (!n) break
      if (
        n.startsWith('#') ||
        n.startsWith('```') ||
        /^[-*•]\s+/.test(n) ||
        /^\d+[.)]\s+/.test(n) ||
        isLabelLine(n) ||
        n.startsWith('|') ||
        /^(-{3,}|\*{3,})$/.test(n)
      ) {
        break
      }
      para.push(n)
      i++
    }
    blocks.push({ type: 'p', text: para.join(' ') })
  }

  return blocks
}

type Props = {
  text: string
  emptyMessage?: string
  onCopy?: () => void
}

export function AiResultView({ text, emptyMessage = 'El resultado aparecerá aquí.' }: Props) {
  if (!text.trim()) {
    return (
      <div className="ai-result ai-result-empty">
        <p className="muted">{emptyMessage}</p>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 8, maxWidth: 360, textAlign: 'center' }}>
          La IA propone; tú revisas. Nada se publica solo.
        </p>
      </div>
    )
  }

  const blocks = parseBlocks(text)

  return (
    <div className="ai-result ai-result-rich">
      {blocks.map((b, idx) => {
        switch (b.type) {
          case 'h': {
            const Tag = (`h${Math.min(b.level + 1, 4)}` as 'h2' | 'h3' | 'h4')
            return (
              <Tag key={idx} className={`ai-h ai-h${b.level}`}>
                {renderInline(b.text)}
              </Tag>
            )
          }
          case 'p':
            return (
              <p key={idx} className="ai-p">
                {renderInline(b.text)}
              </p>
            )
          case 'ul':
            return (
              <ul key={idx} className="ai-ul">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={idx} className="ai-ol">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            )
          case 'label':
            return (
              <div key={idx} className="ai-label-row">
                <span className="ai-label">{b.label}</span>
                <span className="ai-label-value">{renderInline(b.value)}</span>
              </div>
            )
          case 'hr':
            return <hr key={idx} className="ai-hr" />
          case 'code':
            return (
              <pre key={idx} className="ai-code">
                {b.text}
              </pre>
            )
          case 'table':
            return (
              <div key={idx} className="ai-table-wrap">
                <table className="ai-table">
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) =>
                          ri === 0 ? (
                            <th key={ci}>{renderInline(cell)}</th>
                          ) : (
                            <td key={ci}>{renderInline(cell)}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
