// Characters the pet can wear. To add one: download its optimized .vsplat from
// PINOC into assets/characters/ and add a line here; it shows up in 右键 → 切换角色.

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
];

export const DEFAULT_CHARACTER = CHARACTERS[0];

export function findCharacter(id: string | null | undefined): CharacterInfo {
  return CHARACTERS.find((c) => c.id === id) ?? DEFAULT_CHARACTER;
}
