import { defaultPresentation, selectProfile, profileIntro, type Presentation } from '../../supabase/functions/_shared/presentation.ts';
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
  return selectProfile(scores).leaders;
}

export function getProfileDescription(scores: DimensionScores, lang: string, policy: Presentation = defaultPresentation()): string {
  const selection = selectProfile(scores, policy);
  const intro = profileIntro(scores, lang, policy);
  if (selection.kind !== 'single') return intro;
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
  return intro + ' ' + descriptions[selection.leaders[0]][lang === 'ru' ? 'ru' : 'en'];
}
