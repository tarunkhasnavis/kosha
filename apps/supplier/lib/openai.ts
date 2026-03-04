import OpenAI from 'openai'

let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables')
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return _openai
}
