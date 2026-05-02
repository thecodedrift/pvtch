import { describe, it, expect } from 'vitest';
import { renderBoardMarkdown } from '@/lib/markdown';

describe('renderBoardMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderBoardMarkdown(
      '# Heading\n\n**bold** and *italic* and `code`'
    );
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('renders lists and links', () => {
    const html = renderBoardMarkdown(
      '- item one\n- item two\n\n[link](https://example.com)'
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it('escapes raw <script> tags to text', () => {
    const html = renderBoardMarkdown('<script>alert(1)</script>');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes raw <iframe> tags to text', () => {
    const html = renderBoardMarkdown(
      '<iframe src="https://evil.com"></iframe>'
    );
    expect(html).not.toMatch(/<iframe\b/i);
    expect(html).toContain('&lt;iframe');
  });

  it('escapes raw <img onerror=...> to text', () => {
    const html = renderBoardMarkdown('<img src=x onerror=alert(1)>');
    // No parsed <img> tag — the raw HTML is escaped to literal text
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toContain('&lt;img');
  });

  it('escapes raw <style> tags to text', () => {
    const html = renderBoardMarkdown('<style>body{display:none}</style>');
    expect(html).not.toMatch(/<style\b/i);
    expect(html).toContain('&lt;style&gt;');
  });

  it('rejects javascript: hrefs in markdown links', () => {
    const html = renderBoardMarkdown('[click](javascript:alert(1))');
    // No <a href="javascript:..."> attribute is emitted; the link is rejected
    // and rendered as literal text. (The literal text may contain the string
    // "javascript:" but it's not a clickable link.)
    expect(html.toLowerCase()).not.toMatch(/<a[^>]+href\s*=\s*["']javascript:/);
  });

  it('rejects javascript: bare URLs caught by linkify', () => {
    const html = renderBoardMarkdown('Visit javascript:alert(1) for the demo');
    expect(html.toLowerCase()).not.toMatch(/<a[^>]+href\s*=\s*["']javascript:/);
  });

  it('keeps http(s) and mailto links', () => {
    const html = renderBoardMarkdown(
      '[a](https://a.com) [b](http://b.com) [c](mailto:c@d.com)'
    );
    expect(html).toContain('href="https://a.com"');
    expect(html).toContain('href="http://b.com"');
    expect(html).toContain('href="mailto:c@d.com"');
  });

  it('keeps relative and fragment links', () => {
    const html = renderBoardMarkdown('[home](/) [hash](#section)');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="#section"');
  });

  it('does not parse on* event handler attributes from raw HTML', () => {
    // Raw HTML in source is escaped to text; even though "onerror=" appears
    // in the escaped output as literal text, no parsed <img> tag carries it.
    const html = renderBoardMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toMatch(/<img\b/i);
  });

  it('does not render markdown image syntax as <img>', () => {
    const html = renderBoardMarkdown('![alt text](https://example.com/x.png)');
    expect(html).not.toMatch(/<img\b/i);
  });

  it('does not render markdown image syntax with javascript: src', () => {
    const html = renderBoardMarkdown('![x](javascript:alert(1))');
    expect(html).not.toMatch(/<img\b/i);
    expect(html.toLowerCase()).not.toMatch(/<a[^>]+href\s*=\s*["']javascript:/);
  });
});
