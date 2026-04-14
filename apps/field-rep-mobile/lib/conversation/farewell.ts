const FAREWELL_PHRASES = [
  'goodbye',
  'good bye',
  'bye bye',
  'see you later',
  'see you',
  'talk later',
  'chat later',
  'stop recording',
  'end recording',
  'that\'s it',
  'thats it',
  'that covers it',
  'i think we\'re done',
  'i think were done',
  'we\'re good',
  'were good',
  'i\'m done',
  'im done',
  'that\'s all',
  'thats all',
  'thanks kosha',
  'thank you kosha',
]

/**
 * Detects farewell intent from transcript text.
 *
 * Runs locally on the final transcript — no API call needed.
 * Returns true if the rep is signaling they want to end.
 */
export function isFarewell(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return FAREWELL_PHRASES.some((phrase) => lower.includes(phrase))
}

/**
 * Detects WRAP_UP marker in Claude's response.
 */
export function hasWrapUpMarker(text: string): boolean {
  return text.includes('[WRAP_UP]')
}

/**
 * Removes the WRAP_UP marker from text before sending to TTS.
 */
export function removeWrapUpMarker(text: string): string {
  return text.replace('[WRAP_UP]', '').trim()
}
