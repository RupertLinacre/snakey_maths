declare module 'maths-game-problem-generator' {
  export const YEAR_LEVELS: Record<string, string>;
  export const PROBLEM_TYPES: Record<string, string>;
  export function generateProblem(options?: {
    yearLevel?: string;
    type?: string | null;
  }): {
    expression: string;
    expression_short?: string;
    answer: number;
    formattedAnswer?: string;
    type?: string;
    yearLevel?: string;
  };
  export function checkAnswer(
    problem: {
      answer: number;
      formattedAnswer?: string;
    },
    value: number | string,
  ): boolean;
}
