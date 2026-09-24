// Characters the pet can wear. To add one: download its optimized .vsplat from
// PINOC into assets/characters/ and add a line here; it shows up in 右键 → 切换角色.
// Characters you keep to yourself (not in git) go in
// assets/characters/local.json instead (add it to .gitignore): [{ "id", "name", "file", "pinocId" }].

export type CharacterInfo = {
  id: string;
  name: string;
  file: string;
  /** PINOC asset id, to re-download or find it again. */
  pinocId: string;
};

export const CHARACTERS: CharacterInfo[] = [
  { id: 'asian-actor', name: 'Asian Actor', file: 'characters/asian-actor.vsplat', pinocId: '7739ba62-52d7-4784-874c-906838b4da4a' },
  { id: 'man-in-suit', name: 'Man in Suit', file: 'characters/man-in-suit.vsplat', pinocId: '4beb2e24-12a0-420e-8d36-2c4eae7fac62' },
  { id: 'young-man', name: 'Young Man', file: 'characters/young-man.vsplat', pinocId: 'adf8f1a4-4b1a-4237-bfa4-78ff0525dfef' },
  { id: 'dj-neko', name: 'DJ Neko', file: 'characters/dj-neko.vsplat', pinocId: '2405a314-ab4e-4742-afb3-ef22c9331c99' },
  { id: 'chibi-guitarist', name: 'Chibi Guitarist', file: 'characters/chibi-guitarist.vsplat', pinocId: '670e8843-63a7-4104-9cc6-d16784a01f72' },
  { id: 'satoru-gojo', name: 'Satoru Gojo', file: 'characters/satoru-gojo.vsplat', pinocId: '6fff4c02-0827-45a1-9a9e-a8d796647c91' },
  { id: 'creepy-log-man', name: 'Creepy Log Man', file: 'characters/creepy-log-man.vsplat', pinocId: '3c648a69-7844-4c2a-a279-2045b873c1c5' },
  { id: 'miles-morales', name: 'Miles Morales', file: 'characters/miles-morales.vsplat', pinocId: 'd5a0b493-da67-4840-87a7-58b40dcc6216' },
];

export const DEFAULT_CHARACTER = CHARACTERS[0];

/** Add the characters listed in assets/characters/local.json, if there is one (it's gitignored). */
export async function loadLocalCharacters(): Promise<void> {
  try {
    const res = await fetch('characters/local.json');
    if (!res.ok) return;
    const list: unknown = await res.json();
    if (!Array.isArray(list)) return;
    for (const c of list as Partial<CharacterInfo>[]) {
      const ok = typeof c.id === 'string' && typeof c.name === 'string' && typeof c.file === 'string';
      if (ok && !CHARACTERS.some((x) => x.id === c.id)) CHARACTERS.push({ pinocId: '', ...c } as CharacterInfo);
    }
  } catch {
    // No local list (or the dev server answered with its HTML fallback): nothing to add.
  }
}

export function findCharacter(id: string | null | undefined): CharacterInfo {
  return CHARACTERS.find((c) => c.id === id) ?? DEFAULT_CHARACTER;
}
