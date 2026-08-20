import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PublicPage } from '@pages/PublicPage'

type MarkdownBlock =
  | { content: string; kind: 'heading'; level: number }
  | { content: string; kind: 'paragraph' }
  | { items: string[]; kind: 'list'; ordered: boolean }
  | { headers: string[]; kind: 'table'; rows: string[][] }

const headingPattern = /^(#{1,6})\s+(.+)$/u
const listItemPattern = /^(?:(\d+)\.|-)\s+(.+)$/u

export function LegalDocumentPage({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown)

  return (
    <PublicPage className="legal-document-card">
      <div className="legal-document">
        {blocks.map((block, index) => renderBlock(block, index))}
      </div>
    </PublicPage>
  )
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replaceAll('\r\n', '\n').trim().split('\n')
  const blocks: MarkdownBlock[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    if (!line.trim()) {
      lineIndex += 1
      continue
    }

    const heading = line.match(headingPattern)
    if (heading) {
      blocks.push({
        content: heading[2],
        kind: 'heading',
        level: heading[1].length,
      })
      lineIndex += 1
      continue
    }

    if (isTableStart(lines, lineIndex)) {
      const headers = parseTableRow(line)
      const rows: string[][] = []
      lineIndex += 2
      while (
        lineIndex < lines.length &&
        lines[lineIndex].trimStart().startsWith('|')
      ) {
        rows.push(parseTableRow(lines[lineIndex]))
        lineIndex += 1
      }
      blocks.push({ headers, kind: 'table', rows })
      continue
    }

    const listItem = line.match(listItemPattern)
    if (listItem) {
      const ordered = Boolean(listItem[1])
      const items: string[] = []
      while (lineIndex < lines.length) {
        const itemMatch = lines[lineIndex].match(listItemPattern)
        if (!itemMatch || Boolean(itemMatch[1]) !== ordered) {
          break
        }

        const itemLines = [itemMatch[2]]
        lineIndex += 1
        while (
          lineIndex < lines.length &&
          /^\s{2,}\S/u.test(lines[lineIndex])
        ) {
          itemLines.push(lines[lineIndex].trim())
          lineIndex += 1
        }
        items.push(joinWrappedLines(itemLines))
      }
      blocks.push({ items, kind: 'list', ordered })
      continue
    }

    const paragraphLines = [line]
    lineIndex += 1
    while (lineIndex < lines.length && !startsNewBlock(lines, lineIndex)) {
      paragraphLines.push(lines[lineIndex])
      lineIndex += 1
    }
    blocks.push({
      content: joinWrappedLines(paragraphLines),
      kind: 'paragraph',
    })
  }

  return blocks
}

function startsNewBlock(lines: string[], lineIndex: number) {
  const line = lines[lineIndex]
  return (
    !line.trim() ||
    headingPattern.test(line) ||
    listItemPattern.test(line) ||
    isTableStart(lines, lineIndex)
  )
}

function isTableStart(lines: string[], lineIndex: number) {
  if (
    !lines[lineIndex]?.trimStart().startsWith('|') ||
    !lines[lineIndex + 1]?.trimStart().startsWith('|')
  ) {
    return false
  }

  const delimiterCells = parseTableRow(lines[lineIndex + 1])
  return (
    delimiterCells.length > 0 &&
    delimiterCells.every((cell) => /^:?-{3,}:?$/u.test(cell))
  )
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim())
}

function joinWrappedLines(lines: string[]) {
  return lines.reduce((joined, line, index) => {
    const separator =
      index === 0 ? '' : lines[index - 1].endsWith('  ') ? '\n' : ' '
    return `${joined}${separator}${line.trim()}`
  }, '')
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `${block.kind}-${index}`

  if (block.kind === 'heading') {
    const content = renderInline(block.content)
    if (block.level === 1) return <h1 key={key}>{content}</h1>
    if (block.level === 2) return <h2 key={key}>{content}</h2>
    if (block.level === 3) return <h3 key={key}>{content}</h3>
    return <h4 key={key}>{content}</h4>
  }

  if (block.kind === 'paragraph') {
    return <p key={key}>{renderInline(block.content)}</p>
  }

  if (block.kind === 'list') {
    const items = block.items.map((item, itemIndex) => (
      <li key={`${key}-${itemIndex}`}>{renderInline(item)}</li>
    ))
    return block.ordered ? (
      <ol key={key}>{items}</ol>
    ) : (
      <ul key={key}>{items}</ul>
    )
  }

  return (
    <div className="legal-document-table-wrap" key={key} tabIndex={0}>
      <table>
        <thead>
          <tr>
            {block.headers.map((header, cellIndex) => (
              <th key={`${key}-header-${cellIndex}`} scope="col">
                {renderInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`}>
              {block.headers.map((_, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-cell-${cellIndex}`}>
                  {renderInline(row[cellIndex] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderInline(content: string): ReactNode[] {
  const tokens = content.split(/(\*\*[^*]+?\*\*|\[[^\]]+\]\([^)]+\)|\n)/gu)

  return tokens.filter(Boolean).map((token, index) => {
    if (/^\n$/u.test(token)) {
      return <br key={`break-${index}`} />
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`strong-${index}`}>{token.slice(2, -2)}</strong>
    }

    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u)
    if (link) {
      const [, label, href] = link
      return href.startsWith('/') ? (
        <Link key={`link-${index}`} to={href}>
          {label}
        </Link>
      ) : (
        <a key={`link-${index}`} href={href}>
          {label}
        </a>
      )
    }

    return <Fragment key={`text-${index}`}>{token}</Fragment>
  })
}
