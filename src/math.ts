import {
  PROBLEM_TYPES,
  YEAR_LEVELS,
  checkAnswer,
  generateProblem,
} from 'maths-game-problem-generator';

export type ProblemConfig = {
  yearLevel?: string;
  type?: string | null;
};

export type MathLibProblem = {
  expression: string;
  expression_short?: string;
  answer: number;
  formattedAnswer?: string;
  type?: string;
  yearLevel?: string;
};

export function newProblem(config?: ProblemConfig): MathLibProblem {
  const raw = generateProblem(config) as MathLibProblem;
  const answer = typeof raw.answer === 'number' ? raw.answer : Number(raw.answer);

  return {
    expression: raw.expression,
    expression_short: raw.expression_short,
    answer,
    formattedAnswer: raw.formattedAnswer,
    type: raw.type,
    yearLevel: raw.yearLevel,
  };
}

export function isCorrect(problem: MathLibProblem, value: number | string): boolean {
  return checkAnswer(problem, value);
}

export { YEAR_LEVELS, PROBLEM_TYPES };
