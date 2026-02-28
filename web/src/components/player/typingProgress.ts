export interface TypingProgressResult {
  nextTyped: string;
  feedback: 'idle' | 'submitted' | 'rejected';
  shouldSubmit: boolean;
}

export function evaluateTypingProgress(
  targetWord: string,
  nextValue: string
): TypingProgressResult {
  if (!targetWord) {
    return {
      nextTyped: '',
      feedback: 'rejected',
      shouldSubmit: false,
    };
  }

  if (!targetWord.startsWith(nextValue)) {
    return {
      nextTyped: '',
      feedback: 'rejected',
      shouldSubmit: false,
    };
  }

  if (nextValue === targetWord) {
    return {
      nextTyped: nextValue,
      feedback: 'submitted',
      shouldSubmit: true,
    };
  }

  return {
    nextTyped: nextValue,
    feedback: 'idle',
    shouldSubmit: false,
  };
}
