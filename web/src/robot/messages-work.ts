/** Texts of the task page and its sheets, de / en. */
export const WORK_DE = {
  'work.close': 'Schließen',
  'work.parts': 'Ausrüstung',
  'work.edit': 'Skript ändern',
  'work.peek': 'Lösung',
  'work.peekOff': 'Mein Skript',
  'work.peekNote': 'Lösungscode dieser Aufgabe. Du kannst ihn ausführen und Zeile für Zeile verfolgen – dein Skript bleibt unberührt, nichts zählt.',
  'work.improve': 'Skript verbessern',
};

export const WORK_EN = {
  'work.close': 'Close',
  'work.parts': 'Equipment',
  'work.edit': 'Edit script',
  'work.peek': 'See solution',
  'work.peekOff': 'My script',
  'work.peekNote': "This challenge's solution code. Run it and follow it line by line - your script stays untouched and nothing counts.",
  'work.improve': 'Improve script',
};

/** Texts of the script editor's suggestions (popup and insert bar). */
const SUG = {
  'robot.sug.list': ['Vorschläge', 'Suggestions'],
  'robot.sug.off': ['nicht angebaut', 'not built in'],
  'robot.sug.bar': ['Einfügen', 'Insert'],
  'robot.sug.close': ['Schließen', 'Close'],
  'robot.sug.help': ['Hilfe', 'Help'],
  'robot.sug.var': ['Name aus deinem Skript', 'name from your script'],
  'robot.sug.group.flow': ['Python', 'Python'],
  'robot.sug.group.compare': ['Vergleiche', 'Comparisons'],
  'robot.sug.group.move': ['Fahren', 'Moving'],
  'robot.sug.group.blaster': ['Blaster', 'Blaster'],
  'robot.sug.group.cannon': ['Kanone', 'Cannon'],
  'robot.sug.group.hammer': ['Hammer', 'Hammer'],
  'robot.sug.group.eyes': ['Augen', 'Eyes'],
  'robot.sug.group.shield': ['Schild', 'Shield'],
  'robot.sug.group.gps': ['GPS', 'GPS'],
  'robot.sug.group.plates': ['Panzerplatten', 'Armor plates'],
  'robot.sug.group.basics': ['Immer da', 'Always there'],
  'robot.sug.part.blaster': ['Teil: schießt geradeaus', 'part: shoots straight ahead'],
  'robot.sug.part.cannon': ['Teil: schießt mit Stärke 1 bis 2', 'part: shoots with power 1 to 2'],
  'robot.sug.part.eyes': ['Teil: sieht, was vor dir ist', 'part: sees what is ahead'],
  'robot.sug.part.hammer': ['Teil: schlägt aufs Feld vor dir', 'part: hits the tile ahead'],
  'robot.sug.part.shield': ['Teil: blockt einen Treffer', 'part: blocks one hit'],
  'robot.sug.part.gps': ['Teil: kennt Ort und Blickrichtung', 'part: knows position and facing'],
  'robot.sug.part.plates': ['Teil: Panzerplatten', 'part: armor plates'],
  'robot.sug.part.clock': ['Uhr des Kampfs', 'the fight clock'],
  'robot.sug.kw.if': ['wenn: Block nur, falls die Bedingung stimmt', 'runs the block only if the condition holds'],
  'robot.sug.kw.elif': ['sonst wenn: weitere Bedingung', 'else if: another condition'],
  'robot.sug.kw.else': ['sonst: wenn nichts davor galt', 'otherwise: if nothing before held'],
  'robot.sug.kw.while': ['wiederholt, solange die Bedingung stimmt', 'repeats while the condition holds'],
  'robot.sug.kw.for': ['wiederholt für jeden Wert einer Folge', 'repeats for each value of a sequence'],
  'robot.sug.kw.in': ['für: ... in ...', 'used in: for ... in ...'],
  'robot.sug.kw.def': ['definiert eine eigene Funktion', 'defines your own function'],
  'robot.sug.kw.return': ['gibt in einer Funktion einen Wert zurück', 'gives back a value from a function'],
  'robot.sug.kw.True': ['wahr', 'true'],
  'robot.sug.kw.False': ['falsch', 'false'],
  'robot.sug.kw.and': ['beides muss stimmen', 'both must hold'],
  'robot.sug.kw.or': ['eines von beiden reicht', 'one of them is enough'],
  'robot.sug.kw.not': ['kehrt wahr und falsch um', 'turns true into false and back'],
  'robot.sug.fn.range': ['Zahlenfolge, z. B. range(3) ist 0, 1, 2', 'sequence of numbers, e.g. range(3) is 0, 1, 2'],
  'robot.sug.fn.len': ['Länge von Text oder Liste', 'length of a text or list'],
  'robot.sug.fn.print': ['gibt Text aus', 'prints text'],
} as const satisfies Record<string, readonly [string, string]>;
type SugKey = keyof typeof SUG;
const pick = (n: 0 | 1) => Object.fromEntries(Object.entries(SUG).map(([k, v]) => [k, v[n]])) as Record<SugKey, string>;
export const SUG_DE = pick(0);
export const SUG_EN = pick(1);
