import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
});

// Disable markdown image syntax (`![alt](url)`). Boards never need inline
// images, and emitting <img> from user input is an abuse vector (tracking
// pixels, hotlinked NSFW, etc.). With this rule off, image syntax renders
// as literal text. Raw HTML <img> is already neutered by `html: false`.
md.disable(['image']);

const SAFE_LINK = /^(?:https?:|mailto:)/i;

md.validateLink = (url: string): boolean => {
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  return SAFE_LINK.test(trimmed);
};

export function renderBoardMarkdown(source: string): string {
  return md.render(source);
}
