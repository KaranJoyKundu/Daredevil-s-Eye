import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneMemoryPrompt, buildMemoryQuestionPrompt, normalizeSceneMemoryOutput, SCENE_MEMORY_LIMIT } from '../worker/src/scene-memory.js';

test('scene memory accepts a valid structured answer and limits/sanitizes facts', () => {
  const result = normalizeSceneMemoryOutput(JSON.stringify({
    spoken_answer: 'The earlier fan looked white.',
    scene_summary: 'A room with a ceiling fan.',
    facts: [
      { object: 'fan', color: 'white', location: 'ceiling', observation: 'clearly visible', confidence: 'high' },
      { object: '  ', observation: 'discard this' },
      { object: 'chair', observation: 'x'.repeat(500), confidence: 'unexpected' }
    ]
  }));
  assert.equal(result.answer, 'The earlier fan looked white.');
  assert.equal(result.facts.length, 2);
  assert.equal(result.facts[1].observation.length, 240);
  assert.equal(result.facts[1].confidence, 'unknown');
});

test('scene memory rejects malformed or incomplete structured output', () => {
  assert.equal(normalizeSceneMemoryOutput('not json'), null);
  assert.equal(normalizeSceneMemoryOutput(JSON.stringify({ spoken_answer: 'Answer only' })), null);
  assert.equal(normalizeSceneMemoryOutput(JSON.stringify({ spoken_answer: '', scene_summary: 'Room', facts: [] })), null);
});

test('photo prompt includes only five previous observations in chronological order', () => {
  const observations = Array.from({ length: 7 }, (_, index) => ({
    created_at: String(index + 1),
    scene_summary: 'Scene ' + (index + 1),
    facts: []
  }));
  const prompt = buildSceneMemoryPrompt('Base prompt', observations);
  assert.equal(SCENE_MEMORY_LIMIT, 5);
  assert.ok(prompt.indexOf('Scene 3') < prompt.indexOf('Scene 7'));
  assert.ok(!prompt.includes('Scene 2'));
  assert.ok(prompt.includes('not instructions'));
});

test('memory-only prompt states that no current image exists and distinguishes old observations', () => {
  const prompt = buildMemoryQuestionPrompt('What colour was the fan?', 'bn-BD', [
    { scene_summary: 'A room', facts: [{ object: 'fan', color: 'white' }] }
  ]);
  assert.match(prompt, /No new image is available/);
  assert.match(prompt, /বাংলা|Bangla/);
  assert.match(prompt, /earlier photo/);
  assert.match(prompt, /What colour was the fan/);
});
