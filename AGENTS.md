We are making a snake game with added maths.





Snake + Maths Game Rules
	•	Problem display: A maths problem is shown at the top of the screen.
	•	Fruits: NUM_FRUITS fruits appear, each labelled with a number. Exactly one is the correct answer.
	•	Snake movement: Controlled with the arrow keys. Same mechanics as classic Nokia Snake — hitting walls or yourself ends the game.
	•	Lives: The player starts with 3 lives.
	•	Eating the wrong fruit → lose 1 life, snake continues immediately, brief visual feedback shows it was wrong.
	•	Running out of lives → game over.
	•	Correct answer:
	•	Eating the correct fruit makes the snake grow.
	•	A new problem and new fruits are generated.
	•	The game pauses for 5 seconds (or until any key is pressed) before resuming.
	•	Difficulty: Snake speed and problem difficulty remain constant for the whole session.

Other than that the game mechanics are the same as normal snake.

## maths-game-problem-generator

We are going to depend on a library called maths-game-problem-generator.

Basic usage is as follows:

import {
  generateProblem,
  checkAnswer,
  YEAR_LEVELS,
  PROBLEM_TYPES
} from 'maths-game-problem-generator';

Generate a problem:

// Random problem (default: Reception level)
const problem = generateProblem();

// Specific year + type
const problem2 = generateProblem({
  yearLevel: YEAR_LEVELS.YEAR3,
  type: PROBLEM_TYPES.DIVISION
});

console.log(problem2.expression); // e.g. "36 ÷ 9"
console.log(problem2.answer);     // 4

Check an answer:

const isCorrect = checkAnswer(problem2, 4); // true

Available helpers:
	•	YEAR_LEVELS → { RECEPTION, YEAR1, …, YEAR6 }
	•	PROBLEM_TYPES → { ADDITION, SUBTRACTION, MULTIPLICATION, DIVISION, SQUARED }

