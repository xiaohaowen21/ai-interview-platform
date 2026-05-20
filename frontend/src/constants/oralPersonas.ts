export interface OralPersonaVoiceProfile {
  rate: number;
  pitch: number;
  voiceHints: string[];
}

export interface OralPersona {
  key: string;
  label: string;
  subtitle: string;
  description: string;
  voice: OralPersonaVoiceProfile;
  avatar: string;
  accentFrom: string;
  accentTo: string;
}

export interface OralPersonaAvatarOverrides {
  dongmingzhuAvatarUrl?: string | null;
  leijunAvatarUrl?: string | null;
  muskAvatarUrl?: string | null;
  trumpAvatarUrl?: string | null;
}

export const ORAL_PERSONAS: OralPersona[] = [
  {
    key: 'dongmingzhu',
    label: '强势目标导向型面试官',
    subtitle: '强势目标导向',
    description: '关注结果、执行力和抗压能力，追问会更直接。',
    avatar: '/interviewers/dongmingzhu.jpg',
    accentFrom: 'from-rose-500/35',
    accentTo: 'to-orange-500/20',
    voice: {
      rate: 0.95,
      pitch: 0.9,
      voiceHints: ['zh', 'female', 'xiaoxiao', 'xiaoyi'],
    },
  },
  {
    key: 'leijun',
    label: '温和务实型面试官',
    subtitle: '温和务实',
    description: '沟通更克制，强调思路清晰和方法可落地。',
    avatar: '/interviewers/leijun.jpg',
    accentFrom: 'from-sky-500/30',
    accentTo: 'to-cyan-500/20',
    voice: {
      rate: 1,
      pitch: 1.02,
      voiceHints: ['zh', 'male', 'yunxi', 'yunyang'],
    },
  },
  {
    key: 'musk',
    label: '第一性原理型面试官',
    subtitle: '第一性原理',
    description: '偏好拆解底层逻辑，追问技术与决策依据。',
    avatar: '/interviewers/elonmusk.jpg',
    accentFrom: 'from-violet-500/35',
    accentTo: 'to-indigo-500/20',
    voice: {
      rate: 1.04,
      pitch: 0.95,
      voiceHints: ['zh', 'male', 'yunxi', 'yunyang'],
    },
  },
  {
    key: 'trump',
    label: '强压挑战型面试官',
    subtitle: '强压挑战',
    description: '节奏更快，偏挑战式提问，重点看临场应对。',
    avatar: '/interviewers/trump.jpg',
    accentFrom: 'from-amber-500/35',
    accentTo: 'to-red-500/25',
    voice: {
      rate: 1.08,
      pitch: 0.88,
      voiceHints: ['zh', 'male'],
    },
  },
];

export const DEFAULT_ORAL_PERSONA_KEY = ORAL_PERSONAS[0].key;

export function applyOralPersonaAvatarOverrides(
  personas: OralPersona[],
  overrides?: OralPersonaAvatarOverrides | null,
): OralPersona[] {
  if (!overrides) {
    return personas;
  }

  const map: Record<string, string | null | undefined> = {
    dongmingzhu: overrides.dongmingzhuAvatarUrl,
    leijun: overrides.leijunAvatarUrl,
    musk: overrides.muskAvatarUrl,
    trump: overrides.trumpAvatarUrl,
  };

  return personas.map((persona) => {
    const nextAvatar = map[persona.key];
    if (!nextAvatar || !nextAvatar.trim()) {
      return persona;
    }
    return {
      ...persona,
      avatar: nextAvatar.trim(),
    };
  });
}

export function buildOralPersonaStyle(personaKey: string): string {
  return `persona:${personaKey}`;
}

export function parseOralPersonaKey(style?: string | null): string | null {
  if (!style) {
    return null;
  }

  const normalized = style.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('persona:')) {
    const key = normalized.slice('persona:'.length).trim();
    return key || null;
  }

  return normalized;
}

export function getOralPersonaByKey(key?: string | null): OralPersona | null {
  if (!key) {
    return null;
  }
  return ORAL_PERSONAS.find((persona) => persona.key === key) ?? null;
}

export function getOralPersonaByStyle(style?: string | null): OralPersona | null {
  const key = parseOralPersonaKey(style);
  return getOralPersonaByKey(key);
}

export function getOralPersonaByStyleFromList(
  style: string | null | undefined,
  personas: OralPersona[],
): OralPersona | null {
  const key = parseOralPersonaKey(style);
  if (!key) {
    return null;
  }
  return personas.find((persona) => persona.key === key) ?? null;
}
