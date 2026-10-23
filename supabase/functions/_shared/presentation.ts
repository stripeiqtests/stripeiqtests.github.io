// Shared by the browser and email worker: no browser/server dependencies.
export const dimensions = [
  "analyst",
  "strategist",
  "observer",
  "intuitive",
] as const;
export type Dimension = typeof dimensions[number];
export interface ProfileScores {
  analyst_score: number | null;
  strategist_score: number | null;
  observer_score: number | null;
  intuitive_score: number | null;
}
export const dimensionNames: Record<Dimension, { ru: string; en: string }> = {
  analyst: { ru: "Аналитик", en: "Analyst" },
  strategist: { ru: "Стратег", en: "Strategist" },
  observer: { ru: "Наблюдатель", en: "Observer" },
  intuitive: { ru: "Интуит", en: "Intuitive" },
};
export const defaultMessages = {
  paymentConfirming: { ru: "Подтверждаем оплату", en: "Confirming payment" },
  emailQueued: {
    ru: "Копия результата ожидает отправки на",
    en: "Your result copy is queued for",
  },
  emailSent: {
    ru: "Копия передана почтовому сервису для отправки на",
    en: "A copy was accepted by the email service for",
  },
  emailFailed: {
    ru: "Не удалось отправить письмо. Контакт для копии:",
    en: "The email could not be sent. Address for your copy:",
  },
  emailUnknown: {
    ru: "Email для копии результата:",
    en: "Email for your result copy:",
  },
  profileNone: {
    ru: "В этой попытке нет выраженного ведущего измерения.",
    en: "This attempt has no leading dimension.",
  },
  profileMixed: {
    ru: "Смешанный профиль: {dimensions}.",
    en: "Mixed profile: {dimensions}.",
  },
};
export type MessageKey = keyof typeof defaultMessages;
export const messageKeys = Object.keys(defaultMessages) as MessageKey[];
export interface Presentation {
  version: 1;
  ties: "mixed" | "priority";
  zero: "none" | Dimension;
  priority: Dimension[];
  messages: typeof defaultMessages;
}
export function defaultPresentation(): Presentation {
  return {
    version: 1,
    ties: "mixed",
    zero: "none",
    priority: [...dimensions],
    messages: structuredClone(defaultMessages),
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validPresentation(value: unknown): boolean {
  if (
    !record(value) || value.version !== 1 ||
    (value.ties !== "mixed" && value.ties !== "priority") ||
    (typeof value.zero !== "string" ||
      !["none", ...dimensions].includes(value.zero)) ||
    !Array.isArray(value.priority) ||
    value.priority.length !== 4 || new Set(value.priority).size !== 4 ||
    !value.priority.every((d) => dimensions.includes(d as Dimension))
  ) return false;
  if (value.messages === undefined) return true;
  if (!record(value.messages)) return false;
  return Object.entries(value.messages).every(([key, translations]) => {
    if (!messageKeys.includes(key as MessageKey) || !record(translations)) {
      return false;
    }
    return Object.entries(translations).every(([lang, text]) =>
      (lang === "ru" || lang === "en") && typeof text === "string" &&
      text.trim().length > 0 &&
      text.length <= 1000 &&
      (key !== "profileMixed" || text.split("{dimensions}").length === 2)
    );
  });
}
export function parsePresentation(raw: unknown): Presentation {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!validPresentation(value)) return defaultPresentation();
    const p = value as Presentation;
    const result = defaultPresentation();
    result.ties = p.ties;
    result.zero = p.zero;
    result.priority = [...p.priority];
    for (const key of messageKeys) {
      Object.assign(result.messages[key], p.messages?.[key]);
    }
    return result;
  } catch {
    return defaultPresentation();
  }
}
export function selectProfile(
  scores: ProfileScores,
  policy = defaultPresentation(),
): { kind: "none" | "single" | "mixed"; leaders: Dimension[] } {
  const measured = dimensions.filter((d) => {
    const value = scores[`${d}_score`];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      value <= 100;
  });
  if (!measured.length) return { kind: "none", leaders: [] };
  const maximum = Math.max(...measured.map((d) => scores[`${d}_score`]!));
  if (maximum === 0) {
    return policy.zero !== "none" && measured.includes(policy.zero)
      ? { kind: "single", leaders: [policy.zero] }
      : { kind: "none", leaders: [] };
  }
  const leaders = measured.filter((d) => scores[`${d}_score`] === maximum);
  if (leaders.length === 1) return { kind: "single", leaders };
  if (policy.ties === "priority") {
    const chosen = policy.priority.find((d) => leaders.includes(d));
    if (chosen) return { kind: "single", leaders: [chosen] };
  }
  return { kind: "mixed", leaders };
}
export function profileIntro(
  scores: ProfileScores,
  lang: string,
  policy = defaultPresentation(),
): string {
  const { kind, leaders } = selectProfile(scores, policy);
  const locale = lang === "ru" ? "ru" : "en";
  if (kind === "none") return policy.messages.profileNone[locale];
  const labels = leaders.map((d) => dimensionNames[d][locale]).join(", ");
  if (kind === "mixed") {
    return policy.messages.profileMixed[locale].replace("{dimensions}", labels);
  }
  return locale === "ru"
    ? `Ваша сильнейшая сторона — ${labels}.`
    : `Your strongest dimension is ${labels}.`;
}
