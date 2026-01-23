/**
 * Generates a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Transliterate Cyrillic to Latin
        .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v')
        .replace(/г/g, 'g').replace(/д/g, 'd').replace(/е/g, 'e')
        .replace(/ё/g, 'yo').replace(/ж/g, 'zh').replace(/з/g, 'z')
        .replace(/и/g, 'i').replace(/й/g, 'y').replace(/к/g, 'k')
        .replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n')
        .replace(/о/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r')
        .replace(/с/g, 's').replace(/т/g, 't').replace(/у/g, 'u')
        .replace(/ф/g, 'f').replace(/х/g, 'kh').replace(/ц/g, 'ts')
        .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'shch')
        .replace(/ъ/g, '').replace(/ы/g, 'y').replace(/ь/g, '')
        .replace(/э/g, 'e').replace(/ю/g, 'yu').replace(/я/g, 'ya')
        // Replace spaces and special characters with hyphens
        .replace(/[^a-z0-9]+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Limit length
        .substring(0, 50);
}
