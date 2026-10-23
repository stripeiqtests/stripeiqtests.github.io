import { test, expect } from '@playwright/test';
import { leadingDimensions, getProfileDescription, getScoreInterpretation } from '../../src/lib/resultSummary';
import { parseOptions, nextQuestionNumber } from '../../src/lib/testData';

test('zero or missing scores do not invent an analyst profile', () => {
  const empty = { analyst_score: 0, strategist_score: 0, observer_score: null, intuitive_score: null };
  expect(leadingDimensions(empty)).toEqual([]);
  expect(getProfileDescription(empty, 'ru')).toContain('нет выраженного ведущего измерения');
});
test('ties produce a mixed profile and non-dimension numbers are ignored', () => {
  const equal = { analyst_score: 80, strategist_score: 80, observer_score: 40, intuitive_score: null, price_cents: 1000, overall_score: 60 };
  expect(leadingDimensions(equal)).toEqual(['analyst', 'strategist']);
  expect(getProfileDescription(equal, 'ru')).toContain('Смешанный профиль: Аналитик, Стратег');
  expect(getScoreInterpretation(60, 'ru')).toBe('Хороший результат! Ваши способности выше среднего.');
});

test('the technical profile fix preserves the published interpretation and single-leader descriptions',()=>{
  expect(getScoreInterpretation(80,'ru')).toBe('Отлично! Ваши когнитивные способности высокоразвиты.');
  expect(getScoreInterpretation(60,'en')).toBe('Good result! Your abilities are above average.');
  const scores={analyst_score:90,strategist_score:40,observer_score:30,intuitive_score:20};
  expect(getProfileDescription(scores,'ru')).toBe('Ваша сильнейшая сторона — Аналитик. Вы превосходно справляетесь с логическими задачами и анализом данных. Карьера в аналитике, программировании, науке и финансах вам подходит.');
  expect(getProfileDescription({...scores,intuitive_score:100},'en')).toBe('Your strongest dimension is Intuitive. Your creative and associative thinking allows you to find unconventional solutions. Creative professions, innovation, and entrepreneurship are your calling.');
});
test('question validation rejects malformed and empty options; numbering uses the maximum', () => {
  expect(() => parseOptions('{broken')).toThrow();
  expect(() => parseOptions([{ label: 'A', value: '' }, { label: 'B', value: 'B' }])).toThrow();
  expect(() => parseOptions([{ label: 'A', value: 'A' }, { label: 'A', value: 'B' }])).toThrow();
  expect(nextQuestionNumber([{ question_number: 1 }, { question_number: 3 }])).toBe(4);
});
