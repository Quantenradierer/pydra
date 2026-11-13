import { describe, expect, it } from 'vitest';
import { precheck, PRELUDE_LINE_BASE, problemLine, runBuilding, type RunSetup } from './run.ts';
import { problemText } from './friendly.ts';

const setup = (over: Partial<RunSetup> = {}): RunSetup => ({ floors: 2, cars: 1, spawns: [{ tick: 5, from: 0, to: 1 }], goal: { people: 1, seconds: 30 }, trace: true, ...over });
const UP_DOWN = 'elevator.go_to_floor(0)\nelevator.go_to_floor(1)\n';

describe('precheck', () => {
  it('passes plain lines, without any function', () => {
    expect(precheck(UP_DOWN, 1)).toBeUndefined();
    // Even an empty program can run (the elevator just stands still).
    expect(precheck('', 1)).toBeUndefined();
  });

  it('says def on_idle is not needed', () => {
    const p = precheck('def on_idle():\n    elevator.go_to_floor(1)\n', 1);
    expect(p).toEqual({ kind: 'idle-def', line: 1 });
    expect(problemText(p!, 'en')).toBe('You do not need def on_idle() here: your lines without def run anyway every time the elevator has nothing to do (line 1).');
  });

  it('names a handler the building never calls, with a guess', () => {
    const p = precheck('def on_floor_buton(floor):\n    pass\n', 1);
    expect(p).toMatchObject({ kind: 'unknown-handler', name: 'on_floor_buton', line: 1, suggestion: 'on_floor_button' });
    expect(problemText(p!, 'en')).toBe('The building never calls a function "on_floor_buton". Did you mean on_floor_button? (line 1)');
  });

  it('checks the number of parameters: on_floor_button gets the car first when there are two', () => {
    expect(precheck('def on_floor_button(floor):\n    pass\n', 1)).toBeUndefined();
    expect(precheck('def on_floor_button(floor):\n    pass\n', 2)).toMatchObject({ kind: 'handler-params', params: 'elevator, floor' });
    expect(precheck('def on_floor_button(elevator, floor):\n    pass\n', 1)).toMatchObject({ kind: 'handler-params', expected: 1, given: 2 });
    expect(precheck('def on_call(floor):\n    pass\n', 2)).toBeUndefined();
  });

  it('says a car command needs the car in front', () => {
    const p = precheck('go_to_floor(1)\n', 1);
    expect(p).toEqual({ kind: 'needs-elevator', name: 'go_to_floor', line: 1, car: 'elevator' });
    expect(problemText(p!, 'de')).toBe('go_to_floor() ist ein Befehl des Aufzugs: Schreib elevator.go_to_floor(…) (Zeile 1).');
  });

  it('keeps elevator and elevators the building’s', () => {
    expect(precheck('elevator = 3\n', 1)).toMatchObject({ kind: 'read-only', name: 'elevator', line: 1 });
    expect(precheck('elevator = elevators[1]\n', 2)).toMatchObject({ kind: 'read-only', name: 'elevator' });
    expect(precheck('elevators = []\n', 2)).toMatchObject({ kind: 'read-only', name: 'elevators' });
  });

  it('reports syntax errors with the learner’s own line', () => {
    const p = precheck('for floor in range(3)\n    elevator.go_to_floor(floor)\n', 1);
    expect(p?.kind).toBe('python');
    expect(problemLine(p!)).toBe(1);
  });
});

describe('running', () => {
  it('runs the program from the top when the car has nothing to do; each go_to_floor waits for its stop', () => {
    const r = runBuilding(UP_DOWN, setup({ spawns: [{ tick: 5, from: 0, to: 1 }, { tick: 80, from: 0, to: 1 }], goal: { people: 2, seconds: 30 } }));
    expect(r.passed).toBe(true);
    // Part 1 at 0 s: line 1, then it waits for the stop at 0; part 2 goes on after that stop with line 2; part 3 ends.
    expect(r.calls.slice(0, 3)).toMatchObject([
      { tick: 0, handler: null, car: 0, commands: ['elevator.go_to_floor(0)'] },
      { tick: 16, handler: null, car: 0, after: 0, commands: ['elevator.go_to_floor(1)'] },
      { handler: null, car: 0, after: 1, commands: [] },
    ]);
    // Then the car has nothing to do: the next run starts from the top.
    expect(r.calls[3]).toMatchObject({ handler: null, car: 0, commands: ['elevator.go_to_floor(0)'] });
    expect(r.calls[3]!.after).toBeUndefined();
    // One snapshot per tick.
    expect(r.frames.map((f) => f.tick)).toEqual(r.frames.map((_, i) => i));
  });

  it('records the trace of each part in the learner’s own line numbers (the fixed line apart)', () => {
    const r = runBuilding(UP_DOWN, setup());
    const own = (i: number) => r.calls[i]!.trace!.filter((e) => e.k === 'line' && e.line < PRELUDE_LINE_BASE).map((e) => (e as { line: number }).line);
    expect(own(0)).toEqual([1]);
    expect(own(1)).toEqual([2]);
  });

  it('starts every run with fresh variables, and keeps them while a run waits', () => {
    const code = 'trips = 0\ntrips += 1\nelevator.go_to_floor(trips)\nelevator.go_to_floor(trips - 1)\n';
    const r = runBuilding(code, setup({ spawns: [{ tick: 5, from: 0, to: 1 }, { tick: 60, from: 0, to: 1 }], goal: { people: 2, seconds: 40 } }));
    const sent = r.calls.filter((c) => c.handler === null).flatMap((c) => c.commands);
    expect(sent.slice(0, 4)).toEqual(['elevator.go_to_floor(1)', 'elevator.go_to_floor(0)', 'elevator.go_to_floor(1)', 'elevator.go_to_floor(0)']);
  });

  it('knows the handlers from the start of a run, also when their def stands below a go_to_floor', () => {
    const code = 'elevator.go_to_floor(0)\n\ndef on_floor_button(floor):\n    elevator.go_to_floor(floor)\n';
    const r = runBuilding(code, setup());
    expect(r.passed).toBe(true);
    expect(r.calls.find((c) => c.handler === 'on_floor_button')).toMatchObject({ args: ['1'], commands: ['elevator.go_to_floor(1)'] });
  });

  it('passes the floor to on_floor_button and on_call, the functions of the latest run', () => {
    const code = 'def on_call(floor):\n    elevator.go_to_floor(floor)\n\ndef on_floor_button(floor):\n    elevator.go_to_floor(floor)\n';
    const r = runBuilding(code, setup());
    expect(r.passed).toBe(true);
    expect(r.calls.find((c) => c.handler === 'on_call')).toMatchObject({ tick: 5, args: ['0'], commands: ['elevator.go_to_floor(0)'] });
    expect(r.calls.find((c) => c.handler === 'on_floor_button')).toMatchObject({ args: ['1'] });
  });

  it('with two cars: `elevator` is the car with nothing to do, and on_floor_button gets the car', () => {
    const run = runBuilding('elevator.go_to_floor(1)\n', setup({ cars: 2, spawns: [{ tick: 5, from: 1, to: 0 }], goal: { people: 1, seconds: 10 } }));
    expect(run.calls.slice(0, 2)).toMatchObject([
      { handler: null, car: 0, commands: ['elevators[0].go_to_floor(1)'] },
      { handler: null, car: 1, commands: ['elevators[1].go_to_floor(1)'] },
    ]);
    expect(run.calls.slice(0, 2).map((c) => c.after)).toEqual([undefined, undefined]);
    const code = 'def on_call(floor):\n    elevators[1].go_to_floor(floor)\n\ndef on_floor_button(elevator, floor):\n    elevator.go_to_floor(floor)\n';
    const r = runBuilding(code, setup({ cars: 2 }));
    expect(r.passed).toBe(true);
    expect(r.calls.find((c) => c.handler === 'on_floor_button')).toMatchObject({ args: ['elevators[1]', '1'], commands: ['elevators[1].go_to_floor(1)'] });
    expect(r.frames.at(-1)!.cars[0]!.pos).toBe(0);
  });

  it('drives to a floor that does not exist and crashes through the roof, naming the line that sent it', () => {
    const r = runBuilding('elevator.go_to_floor(1)\nelevator.go_to_floor(5)\n', setup());
    expect(r).toMatchObject({ passed: false, crashed: [0], problem: { kind: 'no-floor', floor: 5, max: 1, where: 'roof', line: 2 } });
    // First floor 1 (a normal stop), then up past the roof.
    expect(r.calls.flatMap((c) => c.commands)).toEqual(['elevator.go_to_floor(1)', 'elevator.go_to_floor(5)']);
    expect(r.frames.at(-1)!.cars[0]!.state).toBe('crashed');
    expect(r.frames.at(-1)!.cars[0]!.pos).toBeGreaterThan(1);
    expect(problemText(r.problem!, 'de')).toBe('Eine Etage 5 gibt es nicht, das Haus geht nur bis 1. Der Aufzug ist durchs Dach gekracht (Zeile 2).');
  });

  it('crashes into the bottom of the shaft for a floor below 0', () => {
    const r = runBuilding('elevator.go_to_floor(-1)\n', setup());
    expect(r.problem).toMatchObject({ kind: 'no-floor', floor: -1, where: 'pit', line: 1 });
  });

  it('crashes at once on a floor that is no whole number: "2", 2.5, True, or no floor at all', () => {
    for (const arg of ['"1"', '1.0', 'True', '']) {
      const r = runBuilding(`elevator.go_to_floor(${arg})\n`, setup());
      expect(r, arg).toMatchObject({ passed: false, crashed: [0], problemTick: 0, problem: { kind: 'python', error: { type: 'TypeError' } } });
      expect(r.frames).toHaveLength(1);
    }
    expect(problemText(runBuilding('elevator.go_to_floor("1")\n', setup()).problem!, 'en')).toBe("go_to_floor() needs a whole number, not '1' (line 1).");
  });

  it('crashes the car whose run or handler raised; on_call crashes all of them', () => {
    const two = setup({ cars: 2, spawns: [{ tick: 5, from: 1, to: 0 }] });
    const idle = runBuilding('if elevator == elevators[1]:\n    elevator.go_to_floor(1 / 0)\n', two);
    expect(idle).toMatchObject({ crashed: [1], problem: { kind: 'python', error: { type: 'ZeroDivisionError', line: 2 } } });
    const call = runBuilding('def on_call(floor):\n    elevators[2].go_to_floor(floor)\n', two);
    expect(call).toMatchObject({ crashed: [0, 1], problemTick: 5, problem: { kind: 'python', error: { type: 'IndexError' } } });
  });

  it('crashes on a loop that never ends', () => {
    const r = runBuilding('while True:\n    pass\n', setup());
    expect(r).toMatchObject({ crashed: [0], problemTick: 0, problem: { kind: 'budget' } });
  });

  it('runs out of time when the car never goes up, and says it stood still', () => {
    const r = runBuilding('def on_call(floor):\n    pass\n', setup());
    expect(r).toMatchObject({ passed: false, misses: ['time'], stoodStill: true });
    expect(r.stats.elapsed).toBe(30);
  });

  it('names a floor nobody ever stopped at', () => {
    const r = runBuilding('elevator.go_to_floor(0)\n', setup({ floors: 3, spawns: [{ tick: 5, from: 2, to: 0 }] }));
    expect(r).toMatchObject({ misses: ['time'], neverVisited: 2 });
  });

  it('names lit buttons nobody drives to, but only once the learner knows on_floor_button', () => {
    const code = 'elevator.go_to_floor(0)\n';
    expect(runBuilding(code, setup()).pressedIgnored).toBe(true);
    expect(runBuilding(code, setup({ handlers: [] })).pressedIgnored).toBeUndefined();
  });

  it('goes on after too many trips, and fails at the end', () => {
    const r = runBuilding(UP_DOWN, setup({ spawns: [{ tick: 5, from: 0, to: 1 }, { tick: 40, from: 0, to: 1 }], goal: { people: 2, seconds: 60, maxMoves: 2 } }));
    expect(r).toMatchObject({ passed: false, misses: ['moves'] });
    expect(r.stats.transported).toBe(2);
    expect(r.broken.moves).toBeLessThan(r.frames.at(-1)!.tick);
  });

  it('goes on after somebody waited too long (also before getting in), and fails at the end', () => {
    const r = runBuilding(UP_DOWN, setup({ spawns: [{ tick: 1, from: 1, to: 0 }], goal: { people: 1, seconds: 60, maxWait: 1 } }));
    expect(r).toMatchObject({ passed: false, misses: ['wait'] });
    expect(r.broken.wait).toBe(12);
    expect(r.stats.transported).toBe(1);
  });

  it('waiting(floor) counts the people waiting there; a run that leaves the car idle runs again a second later', () => {
    const code = 'if waiting(1) > 0:\n    elevator.go_to_floor(1)\n    elevator.go_to_floor(0)\n';
    expect(precheck(code, 1)).toBeUndefined();
    const r = runBuilding(code, setup({ spawns: [{ tick: 25, from: 1, to: 0 }] }));
    expect(r).toMatchObject({ passed: true, misses: [] });
    // At first nobody waits: the run sends the car nowhere, and runs again every second until somebody does.
    const runs = r.calls.filter((c) => c.handler === null && c.after === undefined);
    expect(runs.slice(0, 3).map((c) => c.tick)).toEqual([0, 10, 20]);
    expect(runs.find((c) => c.commands.length > 0)!.tick).toBe(30);
  });

  it('does not run a program of only defs again and again', () => {
    const r = runBuilding('def on_call(floor):\n    pass\n', setup());
    expect(r.calls.filter((c) => c.handler === null)).toHaveLength(1);
  });

  it('crashes on waiting() with something else than a whole number', () => {
    const r = runBuilding('if waiting("1") > 0:\n    elevator.go_to_floor(1)\n', setup());
    expect(problemText(r.problem!, 'en')).toBe("waiting() needs a whole number, not '1' (line 1).");
  });

  it('stops at a closed floor in front of the barrier: nobody gets in, the goal is missed at the end', () => {
    const r = runBuilding('elevator.go_to_floor(1)\nelevator.go_to_floor(0)\n', setup({ floors: 3, closed: [1], spawns: [{ tick: 5, from: 2, to: 0 }], goal: { people: 1, seconds: 40, noSiteStops: true } }));
    expect(r.misses).toEqual(['time', 'site']);
    expect(r.stats.siteStops).toBeGreaterThan(0);
    expect(r.frames.some((f) => f.cars[0]!.site)).toBe(true);
  });
});
