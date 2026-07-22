# AfterClass

AfterClass is an AI chat app where you talk to persona versions of two coding educators, Hitesh Choudhary and Piyush Garg. It started as an assignment for the GenAI with JS 2026 cohort, where the goal was to make each persona actually sound like the real person instead of a generic assistant wearing a name tag.

It has since grown a second half. The app now also indexes a 22 hour Expo and React Native course and can answer questions from it, telling you which module, which chapter, and which minute to jump to.

Live app: https://afterclass.thesidharth.com
Repository: https://github.com/sidharthsangelia/chaicode-persona-ai

## Ask the course anything

Type `/course` in the chat box and the assistant switches into course mode. From that point every answer is grounded in the actual course transcripts, and every answer that has something to cite comes back with the exact place to look:

```
Module 2 › Chapter 2: Essential core components      9:23
Pressable component and interaction handling · Suraj Jha
02_essential-core-components(...)_epm
```

The lesson folder name is printed underneath on purpose, because the tidy title you read is not what your file browser shows you. The number and the folder are what actually get you there.

Course mode is sticky. It stays on until you dismiss the chip above the composer, so you can have a whole conversation about the course without repeating yourself.

Outside course mode the assistant behaves like a normal mentor and answers from its own knowledge, which is faster and usually what you wanted. It only reaches for the course when you point at it, either with `/course` or by asking something like "where does the course cover dynamic routes".

A few things worth knowing about how it answers:

- It explains the concept properly first, in the persona's own voice, so you can learn from the answer without watching anything.
- It never writes a timestamp itself. The model only ever emits a citation marker, and the app fills in the real time from the transcript. It can point you at the wrong moment, but it cannot invent a moment that does not exist.
- If the course only half covers your question, it says so, answers the rest from its own knowledge, and still shows you where the related material is.
- If the course genuinely does not cover something, it tells you plainly instead of making something up.

## What else you can do in the app

- Chat with either Hitesh sir or Piyush sir, and switch between them any time
- Each persona replies in their own voice, tone, and teaching style, not a shared generic voice
- Time aware greetings that change through the day, one persona greeting you in Hinglish with a chai heavy tone, the other in a blunter, more English heavy, backend focused tone
- Persona specific starter messages so a new chat doesn't open on a blank screen
- Try the app as a guest with no sign in, up to a small message limit
- Guest conversations are kept in your browser's local storage, so nothing is lost if you close the tab, and the moment you sign in that conversation gets saved properly into the database against your account
- A YouTube tool that looks up real videos and playlists from the actual channel of the persona you're talking to, so recommendations point at real content instead of invented titles

## Tech stack

- Next.js (App Router) and React for the frontend and server logic
- Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) for streaming chat, tool calling, and structured model output
- Qdrant for the vector index of course chunks
- Prisma with the Neon serverless Postgres adapter for chats, messages, and the course catalog, including a Postgres full text index that runs alongside vector search
- Clerk for authentication
- Tailwind CSS, Radix UI, and shadcn style components for the interface
- Streamdown for rendering streamed markdown in chat
- Biome for linting and formatting

## Getting started locally

### 1. Prerequisites

- Node.js (a recent LTS version)
- npm (or pnpm/yarn/bun if you prefer, the scripts below use npm)
- A Postgres database. This project is built around Neon, but any Postgres instance Prisma can connect to will work
- A Qdrant cluster. The free tier is plenty for this course
- A Clerk account for authentication
- An OpenAI API key, used for both chat and embeddings
- A YouTube Data API key for the video recommendation tool

### 2. Clone and install

```bash
git clone https://github.com/sidharthsangelia/chaicode-persona-ai.git
cd chaicode-persona-ai
npm install
```

### 3. Environment variables

Create a `.env` file in the project root. Below is the shape of what this project needs, grouped by what it's for. Fill in your own values, none of the values below are real keys.

```env
# Database (Neon / Postgres)
DATABASE_URL=""
# If your Prisma setup uses a separate direct connection for migrations
# (common with Neon's pooled connection strings), add this too
DIRECT_URL=""

# Vector database (Qdrant)
QDRANT_URL=""
QDRANT_API_KEY=""

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# LLM provider (chat, structured calls, and embeddings)
OPENAI_API_KEY=""

# YouTube recommendation tool
YOUTUBE_API_KEY=""
```

If you deploy on Vercel, add the same variables in the Vercel project settings under Environment Variables.

### 4. Set up the database with Prisma

Generate the Prisma client:

```bash
npx prisma generate
```

Then apply the migrations. Use `migrate deploy` rather than `migrate dev` if there is already real chat data in the database, since `dev` can offer to reset it:

```bash
npx prisma migrate deploy
```

The `build` script already runs `prisma generate` before `next build`, so on platforms like Vercel that part happens for you on every deploy. You still need to run the migration step yourself at least once against a fresh database.

### 5. Build the course index

The course subtitles live in `class-subtitle/`, organised as one folder per module and one folder per lesson. Building the index reads those files, splits them into topic segments and smaller chunks, has a small model write a short description of each chunk, then writes everything to Postgres and Qdrant.

```bash
npx tsx scripts/ingest.ts
```

On the full course that takes a few minutes and costs a few cents. Some useful flags while you're working on it:

```bash
npx tsx scripts/ingest.ts --force        # re-do everything, ignoring the unchanged check
npx tsx scripts/ingest.ts --module 4     # just one module
npx tsx scripts/ingest.ts --limit 3      # first few lessons, for a quick smoke run
npx tsx scripts/ingest.ts --recreate     # drop and rebuild the Qdrant collections
```

Re-running without flags only touches lessons whose subtitle file actually changed, and model responses are cached on disk, so iterating is cheap.

You can skip this step entirely if you only want the persona chat. The course routes will simply find nothing.

### 6. Run the app

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 7. Poke at the retrieval pipeline from the terminal

There are three scripts for looking at what the search is actually doing, without going through the UI. They were the main debugging tool while building this, and most of the bugs in the pipeline were found through them rather than by reading code.

```bash
# what does the raw index return for a literal string?
npx tsx scripts/query.ts "dynamic routes" --legs --context

# the full pipeline: routing, generated queries, fusion, grading, timings
npx tsx scripts/ask.ts "where does the course cover dynamic routes"
npx tsx scripts/ask.ts "pressable or touchable opacity" --course

# end to end, including the persona answer and its citations
npx tsx scripts/answer.ts "where does the course cover dynamic routes"
npx tsx scripts/answer.ts "how do I read route params" --course
```

### 8. Lint and format

```bash
npm run lint
npm run format
```

This project uses Biome for both.

## Project structure (high level)

```
app/            Next.js routes and pages
components/     UI components, chat view, sidebar, message rendering, citations
lib/ai/         Persona prompts and the answer step
lib/rag/        The retrieval pipeline: parsing, chunking, search, grading, citations
lib/chat/       Chat storage, slash commands, shared message types
scripts/        Index building and the pipeline inspection tools
prisma/         Database schema and migrations
actions/        Server actions (chat import, message pruning, and so on)
class-subtitle/ Course subtitles, one folder per module and lesson
transcripts/    Source transcripts used to build the personas
public/         Static assets
```

## Deployment

The live version runs on Vercel at https://afterclass.thesidharth.com. Any standard Next.js hosting that supports the App Router, environment variables, and a Postgres connection will work.

One thing to be aware of: a course question does real work before the first token appears, roughly five seconds of routing, searching, and checking results. Vercel's Fluid Compute allows far more than that, so no background job is needed, but the app streams its progress to the UI so the wait doesn't look like a hang.

## Documentation

- [docs.md](./docs.md) covers how the whole thing was built, the retrieval pipeline first and the persona work after.
- [RAG.md](./RAG.md) is the deeper engineering write up of the pipeline, including the things that went wrong and what each one taught.
