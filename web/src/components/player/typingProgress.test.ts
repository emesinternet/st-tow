import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTypingProgress } from './typingProgress';

test('typing progress advances while input remains a prefix', () => {
  const result = evaluateTypingProgress('anchor', 'anc');
  assert.deepEqual(result, {
    nextTyped: 'anc',
    feedback: 'idle',
    shouldSubmit: false,
  });
});

test('single wrong character resets progress immediately', () => {
  const result = evaluateTypingProgress('anchor', 'anx');
  assert.deepEqual(result, {
    nextTyped: '',
    feedback: 'rejected',
    shouldSubmit: false,
  });
});

test('completing the word submits automatically without Enter', () => {
  const result = evaluateTypingProgress('anchor', 'anchor');
  assert.deepEqual(result, {
    nextTyped: 'anchor',
    feedback: 'submitted',
    shouldSubmit: true,
  });
});
