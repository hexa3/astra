export interface PageDocument { url: string; title: string; text: string }
export interface ModelProvider {
  readonly id: string;
  readonly disclosure: string;
  summarize(page: PageDocument): Promise<string>;
  answer(page: PageDocument, question: string): Promise<string>;
}

const sentences = (text: string): string[] => text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(value => value.trim()).filter(value => value.length > 25) ?? [];
const words = (text: string): string[] => text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
const STOP = new Set('the and for that with this from are was were have has but not you your they their its into about can will would could should page'.split(' '));
const ranked = (page: PageDocument, query = ''): string[] => {
  const source = sentences(page.text).slice(0, 1000);
  const queryWords = new Set(words(query).filter(word => !STOP.has(word)));
  const frequencies = new Map<string, number>();
  for (const word of words(page.text)) if (!STOP.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  return source.map((sentence, index) => {
    const tokens = words(sentence);
    const overlap = tokens.filter(word => queryWords.has(word)).length;
    const relevance = tokens.reduce((sum, word) => sum + Math.min(frequencies.get(word) ?? 0, 12), 0) / Math.max(tokens.length, 1);
    return { sentence, index, score: relevance + overlap * 30 - index / 250 };
  }).filter(item => !queryWords.size || item.score >= 30).sort((a, b) => b.score - a.score).slice(0, queryWords.size ? 3 : 5).sort((a, b) => a.index - b.index).map(item => item.sentence);
};

export class LocalExtractiveProvider implements ModelProvider {
  readonly id = 'local-extractive';
  readonly disclosure = 'Processed locally with sentence ranking. Nothing leaves this device.';
  async summarize(page: PageDocument): Promise<string> {
    const result = ranked(page);
    return result.length ? result.join(' ') : 'This page does not expose enough readable text to summarize.';
  }
  async answer(page: PageDocument, question: string): Promise<string> {
    const result = ranked(page, question);
    return result.length ? result.join(' ') : 'I could not find a relevant passage on this page. Try asking with words used by the page.';
  }
}

export const modelProviders: ReadonlyMap<string, ModelProvider> = new Map([['local-extractive', new LocalExtractiveProvider()]]);
