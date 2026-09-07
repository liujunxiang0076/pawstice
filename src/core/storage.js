import { normalizePetProfile } from '../features/pet/profile.js';

// Keep the original key so renaming the project does not lose existing saves.
export const SAVE_KEY = 'little-paws-save';
const defaults = [82, 90, 76, 95];
export function loadGameState(
  storage = globalThis.localStorage,
  date = new Date().toLocaleDateString('zh-CN'),
) {
  let saved = {};
  try {
    const value = JSON.parse(storage.getItem(SAVE_KEY) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch {
    /* Invalid or unavailable storage starts a usable session. */
  }
  const petProfile = normalizePetProfile(saved.petProfile, saved);
  return {
    petProfile,
    pet: petProfile.species,
    name: petProfile.name,
    coins: Number.isFinite(saved.coins) ? Math.max(0, Math.floor(saved.coins)) : 128,
    stats: defaults.map((fallback, i) =>
      Number.isFinite(saved.stats?.[i]) ? Math.max(0, Math.min(100, saved.stats[i])) : fallback,
    ),
    tasks:
      saved.date === date && Array.isArray(saved.tasks)
        ? [...new Set(saved.tasks.filter((t) => ['feed', 'play', 'pet'].includes(t)))]
        : [],
    entries: Array.isArray(saved.entries)
      ? saved.entries
          .filter((e) => e && typeof e.text === 'string' && typeof e.time === 'string')
          .slice(0, 30)
      : [],
    night: false,
  };
}
export function saveGameState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...state, date: new Date().toLocaleDateString('zh-CN') }),
    );
    return true;
  } catch {
    return false;
  }
}
