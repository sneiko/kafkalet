interface Token {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace'
  text: string
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  // Matches: quoted strings (optionally followed by colon = key), numbers, literals, punctuation
  const regex = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'whitespace', text: code.slice(lastIndex, match.index) })
    }

    const stringPart = match[1]
    const colonPart = match[2]
    const full = match[0]

    if (stringPart !== undefined) {
      if (colonPart !== undefined) {
        tokens.push({ type: 'key', text: stringPart })
        tokens.push({ type: 'punctuation', text: colonPart })
      } else {
        tokens.push({ type: 'string', text: full })
      }
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'number', text: full })
    } else if (full === 'true' || full === 'false') {
      tokens.push({ type: 'boolean', text: full })
    } else if (full === 'null') {
      tokens.push({ type: 'null', text: full })
    } else {
      tokens.push({ type: 'punctuation', text: full })
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < code.length) {
    tokens.push({ type: 'whitespace', text: code.slice(lastIndex) })
  }

  return tokens
}

export function JsonHighlight({ code }: { code: string }) {
  let isJson = false
  try {
    JSON.parse(code)
    isJson = true
  } catch {
    // not JSON
  }

  if (!isJson) {
    return <>{code}</>
  }

  const tokens = tokenize(code)

  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'key':
            return <span key={i} className="text-blue-400 dark:text-blue-300">{token.text}</span>
          case 'string':
            return <span key={i} className="text-green-500 dark:text-green-400">{token.text}</span>
          case 'number':
            return <span key={i} className="text-orange-400">{token.text}</span>
          case 'boolean':
            return <span key={i} className="text-purple-400">{token.text}</span>
          case 'null':
            return <span key={i} className="text-purple-400">{token.text}</span>
          case 'punctuation':
            return <span key={i} className="text-muted-foreground">{token.text}</span>
          default:
            return <span key={i}>{token.text}</span>
        }
      })}
    </>
  )
}
