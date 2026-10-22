export interface AnswerOption { label: string; value: string }

export function parseOptions(value: unknown): AnswerOption[] {
  const options = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(options) || options.length < 2 || options.length > 12
    || options.some(option => !option || typeof option.label !== 'string' || !option.label.trim()
      || typeof option.value !== 'string' || !option.value.trim())
    || new Set(options.map(option => option.label)).size !== options.length) {
    throw new Error('Invalid question options');
  }
  return options;
}

export function validPrice(cents: number | undefined): cents is number {
  return typeof cents === 'number' && Number.isInteger(cents) && cents >= 50 && cents <= 100000;
}

export function nextQuestionNumber(questions: { question_number: number }[]): number {
  return Math.max(0, ...questions.map(question => question.question_number)) + 1;
}
