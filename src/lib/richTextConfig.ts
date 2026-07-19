// Temporary compatibility rollback for content that used a small subset of HTML.
// DOMPurify still removes executable markup when this is enabled.
export const richTextCompatibilityMode =
  import.meta.env.VITE_RICH_TEXT_COMPATIBILITY_MODE === 'true';
