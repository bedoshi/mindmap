import { splitByQuery } from '../model/search'

interface Props {
  text: string
  /** 検索語。null や空のときはハイライトしない */
  query: string | null
}

/** テキストのうち検索語に一致する部分を mark で囲んで表示する */
export function HighlightedText({ text, query }: Props) {
  if (!query) return text
  return splitByQuery(text, query).map((segment, i) =>
    segment.hit ? (
      <mark key={i} className="search-hit">
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  )
}
