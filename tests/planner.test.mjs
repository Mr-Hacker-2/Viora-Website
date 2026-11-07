import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLANNER_GUIDE, parsePlannerCommand } from '../assets/x/planner.js';

test('planner command is case-insensitive and removes only a leading command', () => {
  assert.deepEqual(parsePlannerCommand('  @planner Plan a trip  '), { matched: true, goal: 'Plan a trip' });
  assert.deepEqual(parsePlannerCommand('@PLANNER\nMake a study schedule'), { matched: true, goal: 'Make a study schedule' });
  assert.deepEqual(parsePlannerCommand('Ask @planner to help'), { matched: false, goal: 'Ask @planner to help' });
  assert.deepEqual(parsePlannerCommand('@plannerish should remain text'), { matched: false, goal: '@plannerish should remain text' });
  assert.deepEqual(parsePlannerCommand('@planner'), { matched: true, goal: '' });
});

test('planner mode is available in the picker and keeps the Flash endpoint', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /planner:\s*\{\s*n: 'Viora Planner'/);
  assert.match(html, /planner: 'flash'/);
  assert.match(html, /parsePlannerCommand\(text\)/);
  assert.match(html, /plannerMode \? 'flash'/);
  assert.match(html, /asst === 'human' && !plannerMode/);
  assert.match(html, /plannerMode \? PLANNER_GUIDE/);
  assert.match(html, /u\.planner \? '@planner '/);
  assert.match(PLANNER_GUIDE, /Do not claim to carry out any steps/);
  assert.match(PLANNER_GUIDE, /dependency order/);
});