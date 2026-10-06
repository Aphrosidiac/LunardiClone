import { SITE } from '@/content/site';
import { WORKS } from '@/content/works';
import { ARTICLES } from '@/content/blog';
import { EXPERIMENTS } from '@/content/lab';

// Plain-text map of the site for AI agents (the reference serves one too).
export const dynamic = 'force-static';

export function GET() {
  const at = (p: string) => `${SITE.url}${p}`;
  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    'This site is a demo recreation of edoardolunardi.dev (Edoardo Lunardi), rebuilt by FF Dev Studio to show the interactions can be matched exactly. The work, words and media are FF Dev Studio’s own. The studio’s main site is https://ffdev.studio.',
    '',
    '## Core pages',
    '',
    `- [Home](${at('/')}): the studio, what it builds, and how to start a project.`,
    `- [Works](${at('/works')}): products, client sites and measured recreations.`,
    `- [Blog](${at('/blog')}): engineering notes from the studio’s own builds.`,
    `- [Lab](${at('/lab')}): techniques and films pulled out of the work.`,
    `- [Shots](${at('/shots')}): screens captured from the live sites the studio built.`,
    '',
    '## Works',
    '',
    ...WORKS.map((w) => `- [${w.title}](${at(w.href)}): ${w.description}`),
    '',
    '## Notes',
    '',
    ...ARTICLES.map((a) => `- [${a.title}](${at(a.href)}): ${a.excerpt}`),
    '',
    '## Lab',
    '',
    ...EXPERIMENTS.map((e) => `- [${e.title}](${at(e.href)}): ${e.description}`),
    '',
    '## Contact',
    '',
    `- Email: ${SITE.email}`,
    `- WhatsApp: ${SITE.whatsapp}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
