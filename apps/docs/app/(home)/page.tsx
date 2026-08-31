import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { appName, docsRoute, gitConfig } from '@/lib/shared';

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/only-logo.png" alt="" className="size-14" />
      <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{appName} docs</h1>
      <p className="mt-3 max-w-xl text-fd-muted-foreground">
        Everything you need to self-host {appName}, connect an AI provider and
        WhatsApp, and build agents for your agency&apos;s clients.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`${docsRoute}/getting-started`}
          className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
        >
          Get started <ArrowRight size={16} />
        </Link>
        <a
          href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          GitHub <ExternalLink size={16} />
        </a>
      </div>
      <Cards className="mt-12 w-full text-left">
        <Card title="Self-hosting" href={`${docsRoute}/self-hosting`} description="Docker Compose, the Caddy gateway and environment setup." />
        <Card title="Architecture" href={`${docsRoute}/architecture`} description="Services, data model and tenant isolation." />
        <Card title="AI providers" href={`${docsRoute}/ai-providers`} description="Bring your own OpenAI or Anthropic key." />
        <Card title="WhatsApp" href={`${docsRoute}/whatsapp`} description="Connect a number via the bridge or the Cloud API." />
        <Card title="Knowledge base" href={`${docsRoute}/knowledge-base`} description="Upload PDFs and let agents retrieve from them." />
        <Card title="Custom tools" href={`${docsRoute}/custom-tools`} description="Give agents HTTP endpoints and MCP servers." />
      </Cards>
    </div>
  );
}
