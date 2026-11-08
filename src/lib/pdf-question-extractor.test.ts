import { describe, expect, it } from 'vitest';
import { parseQuestionText } from './pdf-question-extractor';

describe('PDF question text parsing', () => {
  it('splits numbered questions and captures four option labels', () => {
    const text = [
      '1. A body moves with uniform acceleration. Find its final speed.',
      '(A) 2 m/s',
      '(B) 4 m/s',
      '(C) 6 m/s',
      '(D) 8 m/s',
      '2. How many moles are present in 18 g of water?',
      '(A) 0.5',
      '(B) 1',
      '(C) 2',
      '(D) 18',
    ].join('\n');
    const questions = parseQuestionText(text);
    expect(questions).toHaveLength(2);
    expect(questions[0].stem).toContain('uniform acceleration');
    expect(questions[0].options).toEqual(['2 m/s', '4 m/s', '6 m/s', '8 m/s']);
    expect(questions[1].stem).toContain('18 g of water');
    expect(questions[1].options[1]).toBe('1');
  });

  it('keeps an unnumbered scanned question as a reviewable draft', () => {
    const questions = parseQuestionText('Calculate the determinant of [[2, 1], [3, 4]].');
    expect(questions).toEqual([{ stem: 'Calculate the determinant of [[2, 1], [3, 4]].', options: [] }]);
  });

  it('does not invent question drafts from empty text', () => {
    expect(parseQuestionText('   ')).toEqual([]);
  });
});
