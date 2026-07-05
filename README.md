# AfterClass

AfterClass is an AI chat app where you talk to persona versions of two coding educators, Hitesh Choudhary and Piyush Garg. It was built as an assignment for the GenAI with JS 2026 cohort. The goal was to make each persona actually sound like the real person, not a generic assistant wearing a name tag, and to make the app around it feel smooth to use.

Live app: https://afterclass.thesidharth.com
Repository: https://github.com/sidharthsangelia/chaicode-persona-ai

## What you can do in the app

- Chat with either Hitesh sir or Piyush sir, switch between them any time
- Each persona replies in their own voice, tone, and teaching style, not a shared generic voice
- Time aware greetings that change through the day (morning, afternoon, evening, night), one persona greets you in Hinglish with a chai heavy tone, the other in a more English heavy, blunt, backend focused tone
- Persona specific starter messages so a new chat doesn't start on a blank screen
- Try the app as a guest, no sign in needed, with a limit of 5 messages
- Guest conversations are kept in your browser's local storage so nothing is lost if you close the tab, and the moment you sign in, that conversation is picked up from local storage and saved properly into the database against your account
- A YouTube tool that looks up real videos and playlists from the actual channel of the persona you're talking to, so recommendations point to real content instead of made up titles

## Tech stack

- Next.js (App Router) and React for the frontend and server logic
- Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) for streaming chat and tool calling
- Prisma with the Neon serverless Postgres adapter for the database
- Clerk for authentication
- Tailwind CSS, Radix UI, and shadcn style components for the interface
- Streamdown for rendering streamed markdown in chat
- Biome for linting and formatting

## Getting started locally

### 1. Prerequisites

- Node.js (a recent LTS version)
- npm (or pnpm/yarn/bun if you prefer, the scripts below use npm)
- A Postgres database. This project is built around Neon, but any Postgres instance Prisma can connect to will work
- A Clerk account for authentication
- An API key for the LLM provider used by the app
- A YouTube Data API key for the video recommendation tool

### 2. Clone and install

```bash
git clone https://github.com/sidharthsangelia/chaicode-persona-ai.git
cd chaicode-persona-ai
npm install
```

### 3. Environment variables

Create a `.env` file in the project root. Below is the shape of the variables this project needs, grouped by what they're for. Fill in your own values, none of the values below are real keys.

```env
# Database (Neon / Postgres)
DATABASE_URL=""
# If your Prisma setup uses a separate direct connection for migrations
# (common with Neon's pooled connection strings), add this too
DIRECT_URL=""

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# LLM provider
OPENAI_API_KEY=""

# YouTube recommendation tool
YOUTUBE_API_KEY=""

```

- If you deploy on Vercel, add the same variables in the Vercel project settings under Environment Variables.

### 4. Set up the database with Prisma

Generate the Prisma client:

```bash
npx prisma generate
```

Push your schema to the database (good for early development):

```bash
npx prisma db push
```

Or, if you're using migrations:

```bash
npx prisma migrate dev
```

Note that the `build` script already runs `prisma generate` automatically before `next build`, so on platforms like Vercel this happens for you on every deploy:

```json
"build": "prisma generate && next build"
```

You still need to run the schema push or migration step yourself at least once against a fresh database.

### 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 6. Lint and format

```bash
npm run lint
npm run format
```

This project uses Biome for both.

## Project structure (high level)

```
app/            Next.js routes and pages
components/     UI components, chat view, sidebar, message rendering
lib/            Persona definitions, system prompts, AI tools, chat helpers
prisma/         Database schema
actions/        Server actions (chat import, message pruning, etc.)
transcripts/    Source transcripts used to build the personas
public/         Static assets
```

## Deployment

The live version is deployed on Vercel at https://afterclass.thesidharth.com. Any standard Next.js hosting that supports the App Router, environment variables, and a Postgres connection will work.

## Documentation

For details on how the personas were built, the prompt engineering approach, and how conversation context and guest chats are handled, see [DOCS.md](./DOCS.md).