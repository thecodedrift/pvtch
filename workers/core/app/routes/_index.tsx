import { Link } from 'react-router';
import { GithubIcon, ExternalLink, Gauge, Languages, Sparkles } from 'lucide-react';
import type { Route } from './+types/_index';
import { Button } from '@/components/ui/button';
import { PvtchLogo } from '@/components/icons/pvtch-logo';
import { TwitchIcon } from '@/components/ui/icons/twitch';
import { useEffect, useState } from 'react';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'PVTCH - Free Open Source Tools for Twitch Streamers' },
    {
      name: 'description',
      content:
        'Free, open-source streaming tools for Twitch. Customizable OBS progress bars, AI-powered chat translation, and more. No subscriptions, no hidden fees.',
    },
    { property: 'og:title', content: 'PVTCH - Free Open Source Tools for Twitch Streamers' },
    {
      property: 'og:description',
      content:
        'Free streaming tools for Twitch. Customizable OBS progress bars, AI-powered chat translation, and more. No subscriptions, no hidden fees.',
    },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
}

function useLoginUrl() {
  const [loginUrl, setLoginUrl] = useState<string>('#');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    const url = new URL(
      currentUrl.hostname === 'localhost'
        ? 'http://localhost:5173'
        : 'https://www.pvtch.com',
    );
    url.pathname = '/auth/start';
    setLoginUrl(url.toString());
  }, []);

  return loginUrl;
}

const features = [
  {
    icon: Gauge,
    title: 'Progress Bar',
    description:
      'Track goals, sub counts, or any metric with customizable OBS overlays.',
    href: '/widgets/progress',
  },
  {
    icon: Languages,
    title: 'Lingo Translator',
    description:
      'Real-time translation for your stream chat and viewer messages.',
    href: '/helpers/lingo',
  },
  {
    icon: Sparkles,
    title: 'More Coming Soon',
    description:
      'We are actively building new tools. Have an idea? Open an issue on GitHub!',
    href: 'https://github.com/thecodedrift/pvtch/issues',
    external: true,
  },
];

export default function Index() {
  const loginUrl = useLoginUrl();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-purple-500/10 dark:from-brand/5 dark:to-purple-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/20 via-transparent to-transparent opacity-50" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="flex flex-col items-center text-center">
            {/* Logo */}
            <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <PvtchLogo className="size-32 text-brand sm:size-40" />
            </div>

            {/* Heading */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Free Tools for{' '}
              <span className="text-brand">Streamers</span>
            </h1>

            {/* Subheading */}
            <p className="mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Enhance your Twitch streams with powerful, easy-to-use widgets and
              helpers. No subscriptions, no hidden fees — just tools that work.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Button
                size="lg"
                className="bg-[#9146FF] text-white hover:bg-[#7c3aed] gap-2 text-base px-8"
                asChild
              >
                <a href={loginUrl}>
                  <TwitchIcon size={20} />
                  Get Started with Twitch
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 text-base" asChild>
                <Link to="/widgets/progress">
                  Explore Tools
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            Simple tools designed to make your streams more engaging
          </p>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              const content = (
                <div className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:border-brand/50 hover:shadow-lg hover:shadow-brand/5">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold flex items-center gap-2">
                    {feature.title}
                    {feature.external && (
                      <ExternalLink className="size-4 text-muted-foreground" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );

              return feature.external ? (
                <a
                  key={feature.title}
                  href={feature.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              ) : (
                <Link key={feature.title} to={feature.href}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-foreground/5">
              <GithubIcon className="size-8" />
            </div>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Open Source & Self-Hostable
            </h2>
            <p className="mb-8 max-w-2xl text-muted-foreground">
              PVTCH is completely open source. Deploy your own instance for full
              control over your data and customization, or contribute to make it
              better for everyone.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a
                  href="https://github.com/thecodedrift/pvtch"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GithubIcon className="size-5" />
                  View on GitHub
                </a>
              </Button>
              <Button size="lg" variant="ghost" className="gap-2" asChild>
                <Link to="/howto/deploy-your-own">
                  Deploy Your Own
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border bg-gradient-to-t from-brand/5 to-transparent">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            Ready to level up your stream?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Join streamers using PVTCH to create better experiences for their
            viewers.
          </p>
          <Button
            size="lg"
            className="bg-[#9146FF] text-white hover:bg-[#7c3aed] gap-2 text-base px-8"
            asChild
          >
            <a href={loginUrl}>
              <TwitchIcon size={20} />
              Login with Twitch
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
