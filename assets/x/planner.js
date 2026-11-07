export const PLANNER_GUIDE = [
  'PLANNER MODE: Turn the user’s goal into a usable plan. Do not claim to carry out any steps.',
  'Start with the intended outcome, then give ordered, actionable steps in dependency order. Make the next action clear and include a completion check when it helps.',
  'Respect stated deadlines, budgets, resources, skill levels, locations, and requested formats. Do not invent dates, prices, owners, or availability. State assumptions briefly when needed.',
  'Keep simple plans compact. For complex plans, group steps into phases and note important dependencies, risks, and the first next action. Ask one concise clarifying question only when missing information prevents a useful plan; otherwise make reasonable assumptions and proceed.',
  'If current facts matter, use available web research. If it is unavailable, flag the affected assumptions instead of guessing.'
].join('\n');

export function parsePlannerCommand(input) {
  const text = String(input ?? '').trim();
  const command = text.match(/^@planner\b(?:\s+|$)/i);
  return command
    ? { matched: true, goal: text.slice(command[0].length).trim() }
    : { matched: false, goal: text };
}