# Getting started

A first-run walkthrough: install Voysse, create your agency, and send your
first AI-agent reply. For deployment, backups, upgrades and running without
Docker see [Self-hosting](./self-hosting.md); for the full environment
variable reference see [Configuration](./configuration.md).

## Contents

- [Run the stack](#run-the-stack)
- [Create your agency](#create-your-agency)
- [Create your first client](#create-your-first-client)
- [Create your first agent](#create-your-first-agent)
- [Add an AI provider key](#add-an-ai-provider-key)
- [Test it in the Playground](#test-it-in-the-playground)
- [Connect a channel](#connect-a-channel)
- [Next steps](#next-steps)

## Run the stack

You need Docker (see [Self-hosting → Before you begin](./self-hosting.md#before-you-begin)
for exact requirements).

```bash
git clone https://github.com/kanazawa-dev/voysse.git
cd openvoiss
./scripts/generate-docker-env.sh   # writes .env.docker with random secrets (gitignored)
make up                            # builds the images, starts the containers, runs migrations
```

> **Note.** `make up` depends on the `env` target, which runs
> `generate-docker-env.sh` automatically the first time if `.env.docker`
> doesn't exist yet — so `make up` on its own also works. Running the script
> yourself first just lets you see the file it wrote.

Once it finishes, `make up` prints where to go:

```
App:  http://localhost:3000
API docs (local): http://localhost:8000/docs
```

Run `make ps` to confirm every service reports `healthy`.

## Create your agency

Open `http://localhost:3000` (the gateway) — you land on the login page.
Switch to the **Register** tab and fill in:

| Field | Notes |
| --- | --- |
| Agency name | Shown in the dashboard and used to derive the agency's slug/identifier. |
| Your name | The admin user's display name. |
| Email | Login email. |
| Password | Minimum 8 characters. |

Submitting creates a brand-new agency and makes this user its admin — there's
no invitation step for the first account. Voysse is built for **one agency
per instance** (see [Self-hosting](./self-hosting.md)), so this is normally
the only time you'll see the register form.

## Create your first client

Go to **Clients → New client** (`/clients/new`). Only **Name** is required;
everything else is optional:

| Field | Purpose |
| --- | --- |
| Name | Required. |
| Industry | Free text, shown on the client's page. |
| Description | Free text, shown on the client's page. |
| General context | Shared context injected into **every agent's** system prompt for this client — products, audience, policies, anything all of that client's agents should know. It combines with each agent's own instructions, personality and knowledge base. |
| Active client | On by default; turn it off to pause the client without deleting it. |

## Create your first agent

Go to **Agents → New agent** (`/agents/new`). It's a 5-step wizard:

1. **Template** — pick an industry starter (Restaurant orders, Real estate
   leads, Clinic appointments, Online store support, Customer support) to
   pre-fill description, instructions and personality, or start **Blank**.
2. **Identity** — choose the client this agent belongs to, its name, and a
   short description.
3. **Prompt** — the **Instructions** (what the agent should do) and
   **Personality** (tone) text areas, with a live token counter under a
   context-usage bar.
4. **Model** — timezone (defaults to your browser's), **Provider**
   (`OpenAI` or `Anthropic`), **Model** (a per-provider preset list, or type a
   custom one), and three sliders: **Temperature** (0–2, default 0.7),
   **Max tokens** (256–8192, default 2048) and **Conversation memory** — how
   many past messages the agent keeps in context (0–100, default 30).
5. **Review** — confirms name, client, template and provider/model, then
   creates the agent.

## Add an AI provider key

The agent needs a working AI connection to reply. Go to **Settings → AI
provider keys** and add your own **OpenAI** or **Anthropic** API key
(bring-your-own-key, agency-level). The key is validated against the real
provider before it's stored — an invalid key is rejected and nothing is
saved. See [AI providers](./ai-providers.md) for provider-specific details
and any OpenAI-compatible endpoint.

## Test it in the Playground

Go to **Playground** (`/playground`). Pick the **client** and **agent** from
the selectors at the top (only agents belonging to the selected client are
listed), then either continue the agent's existing conversation or start a
new one. Type a message in the composer and send it — the agent replies
using its configured provider, model and prompt, exactly as it would over a
real channel; tool calls and knowledge sources used for the reply are shown
inline. If the agent has image recognition enabled you can also attach an
image with a caption.

## Connect a channel

Once you're happy with the agent in the Playground, connect it to a real
channel from the client's page or **Channels**:

- **WhatsApp** (WhatsApp Cloud API or QR via Baileys) — see [Channels](./whatsapp.md).
- **Web chat widget** — an embeddable widget served at `/widget/<publicId>`
  for any website, no channel-specific setup beyond enabling it on the agent.

## Next steps

- [Architecture](./architecture.md) — services, data model and tenant isolation.
- [Self-hosting](./self-hosting.md) — deploy to a server, HTTPS, backups, upgrades.
- [Configuration](./configuration.md) — the full environment variable reference.
