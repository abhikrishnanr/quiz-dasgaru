export const HOST_SCRIPTS = {
  INTRO: 'System Online. Welcome to the Quiz.',
  TIME_UP: 'Time is up. Moving to the next question.',
  READ_QUESTION: 'Question for {teamName}.',
} as const;

export const AI_COMMENTS = {
  CORRECT: ['Kalakki!', 'Polichu!', 'Mass!', 'Pwoli answer!', 'Kidilan move!'],
  WRONG: ['Shokam...', 'Enthonnade ithu?', 'Chathi Kule!', 'Ayyayyo poyi!', 'Ithu sheriyalla ketto.'],
} as const;

export function constructVerdict(
  isCorrect: boolean,
  teamName: string,
  correctOption: string,
  selectedOption?: string,
): { meme: string; technical: string } {
  const pool = isCorrect ? AI_COMMENTS.CORRECT : AI_COMMENTS.WRONG;
  const meme = pool[Math.floor(Math.random() * pool.length)] ?? (isCorrect ? 'Kalakki!' : 'Shokam...');

  if (isCorrect) {
    return {
      meme,
      technical: `${teamName}, correct answer confirmed. Option ${correctOption} is right.`,
    };
  }

  if (!selectedOption) {
    return {
      meme,
      technical: `${teamName}, the correct answer is option ${correctOption}.`,
    };
  }

  return {
    meme,
    technical: `${teamName}, you chose ${selectedOption}, but the answer is ${correctOption}.`,
  };
}
