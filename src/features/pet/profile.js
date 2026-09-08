/** Serializable appearance only. Needs, rewards and room position belong to the game. */
export const PROFILE_VERSION = 1;
export const PET_SPECIES = Object.freeze({
  cat: {
    label: '猫咪',
    description: '安静好奇，喜欢观察',
    defaultName: '奶糖',
    fur: '#d7bea0',
    tailSpeed: 2.2,
    tailSwing: 0.22,
    earHeight: 0.28,
    earWidth: 0.145,
  },
  dog: {
    label: '柴犬',
    description: '活泼亲人，喜欢玩耍',
    defaultName: '布丁',
    fur: '#c68c4e',
    tailSpeed: 9,
    tailSwing: 0.5,
    earHeight: 0.24,
    earWidth: 0.12,
  },
});
export const PATTERNS = Object.freeze({ solid: '纯色', socks: '白袜', stripes: '条纹' });
export const COAT_PRESETS = Object.freeze([
  { name: '奶油', fur: '#d7bea0', accent: '#f1e3c9' },
  { name: '焦糖', fur: '#b97749', accent: '#f4dcc2' },
  { name: '雾灰', fur: '#8296a3', accent: '#e7e7df' },
  { name: '墨黑', fur: '#384650', accent: '#e6d9c8' },
]);
export const PET_STYLE_PRESETS = Object.freeze([
  {
    id: 'corgi',
    species: 'dog',
    name: '柯基',
    description: '短腿、笑脸、白围脖',
    fur: '#c87533',
    accent: '#fff0da',
    eyes: '#2d221d',
    pattern: 'socks',
    collar: true,
    collarColor: '#b85038',
    size: 0.9,
  },
  {
    id: 'golden',
    species: 'dog',
    name: '金毛',
    description: '暖金毛色，亲人温顺',
    fur: '#d99a4f',
    accent: '#ffe1af',
    eyes: '#3b2519',
    pattern: 'solid',
    collar: true,
    collarColor: '#497f8e',
    size: 1,
  },
  {
    id: 'shiba',
    species: 'dog',
    name: '柴犬',
    description: '精神耳朵，奶油白脸',
    fur: '#bd6f34',
    accent: '#f5dfc2',
    eyes: '#2c241f',
    pattern: 'socks',
    collar: true,
    collarColor: '#c25f45',
    size: 0.95,
  },
  {
    id: 'bichon',
    species: 'dog',
    name: '比熊',
    description: '柔软白毛，圆圆轮廓',
    fur: '#f4eee3',
    accent: '#ffffff',
    eyes: '#1f1b19',
    pattern: 'solid',
    collar: true,
    collarColor: '#6a9ca8',
    size: 0.86,
  },
  {
    id: 'schnauzer',
    species: 'dog',
    name: '雪纳瑞',
    description: '灰黑毛色，利落眉须',
    fur: '#5e6265',
    accent: '#d7d2c8',
    eyes: '#1d1a17',
    pattern: 'socks',
    collar: true,
    collarColor: '#8f4d3c',
    size: 0.85,
  },
  {
    id: 'orange-tabby',
    species: 'cat',
    name: '橘猫',
    description: '橘金条纹，眼神清亮',
    fur: '#d8863c',
    accent: '#ffdfb2',
    eyes: '#2d6f8a',
    pattern: 'stripes',
    collar: true,
    collarColor: '#4c91a0',
    size: 0.9,
  },
  {
    id: 'british-shorthair',
    species: 'cat',
    name: '英短',
    description: '圆脸灰毛，安静好奇',
    fur: '#7f858b',
    accent: '#ddd5c8',
    eyes: '#c89229',
    pattern: 'solid',
    collar: false,
    collarColor: '#cd7854',
    size: 0.92,
  },
  {
    id: 'silver-tabby',
    species: 'cat',
    name: '美短',
    description: '银灰虎斑，活泼机敏',
    fur: '#b9b7ae',
    accent: '#ede5d7',
    eyes: '#8a6d24',
    pattern: 'stripes',
    collar: false,
    collarColor: '#cd7854',
    size: 0.88,
  },
  {
    id: 'ragdoll',
    species: 'cat',
    name: '布偶猫',
    description: '奶油长毛，蓝眼温柔',
    fur: '#ead6bf',
    accent: '#fff7e8',
    eyes: '#416e9e',
    pattern: 'socks',
    collar: true,
    collarColor: '#5891a2',
    size: 1,
  },
  {
    id: 'tuxedo',
    species: 'cat',
    name: '奶牛猫',
    description: '黑白礼服，灵动俏皮',
    fur: '#1f2326',
    accent: '#f3eadc',
    eyes: '#b58a27',
    pattern: 'socks',
    collar: false,
    collarColor: '#cd7854',
    size: 0.9,
  },
]);
export const PET_BREEDS = Object.freeze(
  Object.fromEntries(PET_STYLE_PRESETS.map(({ id, species, name }) => [id, { species, name }])),
);
const validColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const supported = (registry, value) => typeof value === 'string' && Object.hasOwn(registry, value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function createPetProfile(species = 'cat') {
  const id = supported(PET_SPECIES, species) ? species : 'cat';
  return {
    version: PROFILE_VERSION,
    species: id,
    name: PET_SPECIES[id].defaultName,
    fur: PET_SPECIES[id].fur,
    accent: '#f1e3c9',
    eyes: '#3a362d',
    pattern: 'socks',
    collar: false,
    collarColor: '#cd7854',
    size: 1,
    breed: species === 'dog' ? 'shiba' : 'british-shorthair',
  };
}

/** Lenient boundary for old/corrupted saves; returns a new allowlisted object. */
export function normalizePetProfile(input, legacy = {}) {
  const raw = object(input) ? input : {};
  const species = supported(PET_SPECIES, raw.species)
    ? raw.species
    : supported(PET_SPECIES, legacy.pet)
      ? legacy.pet
      : 'cat';
  const result = createPetProfile(species);
  const name = typeof raw.name === 'string' ? raw.name : legacy.name;
  if (typeof name === 'string' && name.trim()) result.name = [...name.trim()].slice(0, 12).join('');
  for (const key of ['fur', 'accent', 'eyes', 'collarColor'])
    if (validColor(raw[key])) result[key] = raw[key].toLowerCase();
  if (supported(PATTERNS, raw.pattern)) result.pattern = raw.pattern;
  if (typeof raw.collar === 'boolean') result.collar = raw.collar;
  if (typeof raw.size === 'number' && Number.isFinite(raw.size))
    result.size = Math.min(1, Math.max(0.8, raw.size));
  if (supported(PET_BREEDS, raw.breed) && PET_BREEDS[raw.breed].species === species)
    result.breed = raw.breed;
  return result;
}

/** Imports are strict: a future schema must never silently lose fields. */
export function parsePetProfile(text) {
  if (typeof text !== 'string' || text.length > 32768) throw new Error('配置文件不能超过 32KB');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON 配置');
  }
  if (!object(raw) || raw.version !== PROFILE_VERSION)
    throw new Error('暂不支持此配置版本，需要 version: 1');
  if (!supported(PET_SPECIES, raw.species)) throw new Error('暂时只支持猫咪和柴犬');
  if (typeof raw.name !== 'string' || !raw.name.trim() || [...raw.name.trim()].length > 12)
    throw new Error('名字需为 1–12 个字符');
  for (const key of ['fur', 'accent', 'eyes', 'collarColor'])
    if (!validColor(raw[key])) throw new Error('颜色必须使用 #RRGGBB 格式');
  if (!supported(PATTERNS, raw.pattern) || typeof raw.collar !== 'boolean')
    throw new Error('花纹或项圈配置不正确');
  if (typeof raw.size !== 'number' || !Number.isFinite(raw.size) || raw.size < 0.8 || raw.size > 1)
    throw new Error('体型范围为 0.8–1.0');
  if (
    raw.breed !== undefined &&
    (!supported(PET_BREEDS, raw.breed) || PET_BREEDS[raw.breed].species !== raw.species)
  )
    throw new Error('宠物品种配置不正确');
  return normalizePetProfile(raw);
}

export function serializePetProfile(profile) {
  return JSON.stringify(normalizePetProfile(profile), null, 2);
}

/** Generated from the same palette as the 3D model, not a static species icon. */
export function petPortrait(profile) {
  const p = normalizePetProfile(profile);
  const stripes =
    p.pattern === 'stripes'
      ? `<path d="m42 27 3 13m12-13-2 13" stroke="${p.accent}" stroke-width="5" stroke-linecap="round"/>`
      : '';
  const collar = p.collar
    ? `<path d="M29 82q21 9 43 0" stroke="${p.collarColor}" stroke-width="8" fill="none"/>`
    : '';
  const muzzle =
    p.species === 'cat'
      ? '<path d="M50 69v5m0 0q-8 6-12-1m12 1q7 6 12-1" fill="none" stroke="#59483e" stroke-width="2"/>'
      : '<path d="M43 73q8 10 17 0" fill="none" stroke="#59483e" stroke-width="2"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="#d9d3c7"/><path d="M22 43 18 16 40 29Q50 25 62 29L82 16 78 44Q88 78 50 87 14 79 22 43" fill="${p.fur}" stroke="#59483e" stroke-width="2"/>${stripes}<path d="M26 60Q50 47 76 60L74 74Q50 92 26 74" fill="${p.accent}"/><ellipse cx="36" cy="55" rx="4" ry="5" fill="${p.eyes}"/><ellipse cx="64" cy="55" rx="4" ry="5" fill="${p.eyes}"/><path d="m45 64 5 6 6-6z" fill="#765342"/>${muzzle}${collar}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
