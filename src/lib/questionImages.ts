import type { Question } from './supabase';

type QuestionImageReference = Pick<Question, 'image_url' | 'question_number'>;

const legacyImageSets: Record<number, string[]> = {
  11: ['/question_images/q11_1.gif', '/question_images/q11_2.gif'],
  12: ['/question_images/q12_1.gif', '/question_images/q12_2.gif'],
  13: ['/question_images/q13.gif'],
  14: ['/question_images/q14.gif'],
  15: ['/question_images/q15.gif'],
  16: ['/question_images/q16.gif'],
  17: [
    '/question_images/q17_1.gif',
    '/question_images/q17_2.gif',
    '/question_images/q17_3.gif',
  ],
  18: ['/question_images/q18.gif'],
  19: ['/question_images/q19_1.gif', '/question_images/q19_2.gif'],
  20: ['/question_images/q20.gif'],
  21: ['/question_images/q21_1.gif', '/question_images/q21_2.gif'],
};

export function getQuestionImageUrls(question: QuestionImageReference): string[] {
  if (!question.image_url) return [];

  const legacyQuestionNumber = Number(
    question.image_url.match(/\/question_images\/q(\d+)/)?.[1],
  );
  const legacyImages = legacyImageSets[legacyQuestionNumber];

  return legacyImages ?? [question.image_url];
}
