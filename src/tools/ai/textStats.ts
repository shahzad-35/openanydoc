// How long a text is for an AI chat: tokens counted with gpt-tokenizer (MIT) and its o200k_base encoding (the one of OpenAI's
// GPT-4o family), loaded only when first asked for; words and characters as a reader counts them. Other models use other
// tokenizers, so for them the count is an estimate (the pages say so). The pages never name the library (owner's wish).

export async function countTokens(text: string) {
  const { countTokens: countEncodedTokens } = await import('gpt-tokenizer/encoding/o200k_base')
  return countEncodedTokens(text)
}

// Words in any script (Arabic too), by the browser's own word breaking; numbers count as words.
export function countWords(text: string) {
  let wordCount = 0
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) if (segment.isWordLike) wordCount++
  return wordCount
}

// Characters as a reader sees them: an emoji or a letter with its marks is one.
export function countCharacters(text: string) {
  let characterCount = 0
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) if (segment.segment) characterCount++
  return characterCount
}
