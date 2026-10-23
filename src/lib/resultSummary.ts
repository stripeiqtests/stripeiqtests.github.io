export interface DimensionScores {
  analyst_score: number | null;
  strategist_score: number | null;
  observer_score: number | null;
  intuitive_score: number | null;
}

export function getScoreInterpretation(score: number, lang: string): string {
  if (lang === 'ru') {
    if (score >= 80) return 'Отлично! Ваши когнитивные способности высокоразвиты.';
    if (score >= 60) return 'Хороший результат! Ваши способности выше среднего.';
    if (score >= 40) return 'Средний результат. Есть потенциал для развития.';
    return 'Есть возможности для улучшения в этой области.';
  }
  if (score >= 80) return 'Excellent! Your cognitive abilities are highly developed.';
  if (score >= 60) return 'Good result! Your abilities are above average.';
  if (score >= 40) return 'Average result. There is potential for development.';
  return 'There are opportunities for improvement in this area.';
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
  if (!leaders.length) return lang === 'ru' ? 'В этой попытке нет выраженного ведущего измерения.' : 'This attempt has no leading dimension.';
  const names: Record<string, string> = lang === 'ru' ? { analyst: 'Аналитик', strategist: 'Стратег', observer: 'Наблюдатель', intuitive: 'Интуит' } : { analyst: 'Analyst', strategist: 'Strategist', observer: 'Observer', intuitive: 'Intuitive' };
  const labels = leaders.map(key => names[key]).join(', ');
  if (leaders.length > 1) return lang === 'ru' ? `Смешанный профиль: ${labels}.` : `Mixed profile: ${labels}.`;
  // Preserve the published descriptions. The audit changes only which profile
  // is selected for zero/tied scores, not the author's interpretation text.
  const descriptions: Record<string, { ru: string; en: string }> = {
    analyst: {
      ru: 'Вы превосходно справляетесь с логическими задачами и анализом данных. Карьера в аналитике, программировании, науке и финансах вам подходит.',
      en: 'You excel at logical tasks and data analysis. Your approach to problem-solving is based on facts and rational thinking. Careers in analytics, programming, science, and finance suit you well.',
    },
    strategist: {
      ru: 'Вы умеете планировать наперёд и видеть общую картину. Лидерство, управление проектами и бизнес-планирование — ваши сильные стороны.',
      en: 'You are skilled at planning ahead and seeing the big picture. Leadership positions, project management, and business planning are your strengths.',
    },
    observer: {
      ru: 'У вас отличное пространственное мышление и внимание к деталям. Карьера в дизайне, архитектуре, инженерии и искусстве вам подходит.',
      en: 'You have excellent spatial thinking and attention to detail. Careers in design, architecture, engineering, and art suit you.',
    },
    intuitive: {
      ru: 'Ваше творческое мышление позволяет находить нестандартные решения. Творческие профессии, инновации и предпринимательство — ваше призвание.',
      en: 'Your creative and associative thinking allows you to find unconventional solutions. Creative professions, innovation, and entrepreneurship are your calling.',
    },
  };
  const prefix = lang === 'ru' ? `Ваша сильнейшая сторона — ${labels}. ` : `Your strongest dimension is ${labels}. `;
  return prefix + descriptions[leaders[0]][lang === 'ru' ? 'ru' : 'en'];
}
