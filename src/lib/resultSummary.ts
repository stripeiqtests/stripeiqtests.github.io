export interface DimensionScores {
  analyst_score: number | null;
  strategist_score: number | null;
  observer_score: number | null;
  intuitive_score: number | null;
}

export function getScoreInterpretation(score: number, lang: string): string {
  return lang === 'ru'
    ? `${Math.round(score)} из 100 — среднее четырёх показателей этой попытки. Это не стандартизированный IQ и не сравнение с другими людьми.`
    : `${Math.round(score)} out of 100 is the average of this attempt’s four dimension scores. It is not a standardized IQ or a comparison with other people.`;
}

export function leadingDimensions(scores: DimensionScores): string[] {
  const entries = [
    ['analyst', scores.analyst_score], ['strategist', scores.strategist_score],
    ['observer', scores.observer_score], ['intuitive', scores.intuitive_score],
  ].filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  const maximum = Math.max(0, ...entries.map(([, value]) => value));
  return maximum > 0 ? entries.filter(([, value]) => value === maximum).map(([key]) => key) : [];
}

export function getProfileDescription(scores: DimensionScores, lang: string): string {
  const leaders = leadingDimensions(scores);
  if (!leaders.length) return lang === 'ru' ? 'В этой попытке нет выраженного ведущего измерения. Этот результат описывает ответы на конкретные задания, а не ваши способности в целом.' : 'This attempt has no leading dimension. The result describes answers to these tasks, not your abilities as a whole.';
  const names: Record<string, string> = lang === 'ru' ? { analyst: 'Аналитик', strategist: 'Стратег', observer: 'Наблюдатель', intuitive: 'Интуит' } : { analyst: 'Analyst', strategist: 'Strategist', observer: 'Observer', intuitive: 'Intuitive' };
  const labels = leaders.map(key => names[key]).join(', ');
  if (leaders.length > 1) return lang === 'ru' ? `Смешанный профиль: ${labels}. У этих измерений одинаковая доля правильных ответов.` : `Mixed profile: ${labels}. These dimensions have equal proportions of correct answers.`;
  return lang === 'ru' ? `В этой попытке наибольшая доля правильных ответов — в измерении «${labels}». Вывод относится только к заданиям этого теста.` : `In this attempt, ${labels} has the highest proportion of correct answers. This applies only to the tasks in this test.`;
}
