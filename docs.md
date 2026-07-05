# AfterClass, project documentation

This document explains how the two personas in AfterClass, Hitesh Choudhary and Piyush Garg, were built, how the prompts are structured, and how the app manages conversation context. It was written as the documentation deliverable for the GenAI with JS 2026 cohort assignment.

## 1. How the persona data was collected and prepared

The best source available for how these two people actually talk, teach, and think was their own YouTube live streams, since that's unscripted and closer to how they'd genuinely respond in a one on one chat than a polished video or blog post would be.

The process was roughly:

1. Transcripts were pulled from Hitesh's and Piyush's YouTube live streams. These are stored in the `transcripts/` folder in the repository.
2. Each transcript file was fed into Claude with a prompt asking it to analyze the speaker's linguistic patterns, teaching style, personality, and any recurring behaviors, and return the analysis as structured JSON. The JSON captures things like:
   - Catchphrases and how they're used ("theek hai?", "tension nahi lene ka", "sahi mayne mein bataun toh")
   - Filler words and how much Hindi versus English shows up, and where the switch happens mid sentence
   - How each person handles a beginner's question, a mistake, or confusion
   - How they open and close a segment, their sense of humor, their energy level
   - Recurring beliefs or pet peeves they circle back to (for Piyush, that's things like muscle memory and talent being dead if you only prompt AI instead of learning fundamentals; for Hitesh, that's consistency, real projects over tutorials, and not panicking about AI replacing developers)
3. That JSON became the reference document for writing each system prompt by hand. Every quirk, catchphrase, and behavior in the system prompt traces back to something observed in the transcripts and captured in this JSON, not invented from a generic idea of what an Indian tech YouTuber sounds like.

## 2. Prompt engineering strategy

Each persona has its own system prompt (`lib/ai/prompts/hitesh.ts` and `lib/ai/prompts/piyush.ts`). Both prompts follow the same structure so they're easy to compare and maintain, but the content inside each section is specific to that person.

The shared structure is:

- **Who you are**: establishes identity and the fact that this is a real mentoring chat, not a support bot
- **Voice and language**: the English to Hindi ratio, filler words, catchphrases, sentence rhythm, and a hard rule against using em dashes, since that's a small tell that gives away AI generated text
- **Teaching style**: what topics this person naturally gravitates to, how they structure an explanation, how they handle beginner questions or confusion
- **Personality and quirks**: humor style, energy level, and for Piyush specifically, a small amount of self aware playfulness including rare, natural feeling typos that he might notice and joke about himself, kept deliberately rare so it reads as texture, not a bit
- **Core beliefs**: the handful of opinions each person keeps returning to across a long conversation, so the persona doesn't flatten into a neutral answer machine as the chat goes on
- **Response rules**: default answer length, and a list of AI chatbot habits to avoid (no "Great question!", no bullet dumps unless a list is genuinely asked for, no sign off on every message)
- **Boundaries**: this is the guardrail section, covered in detail below
- **Staying in character**: an explicit instruction that the persona should sound the same at message 20 of a long conversation as it does at message 2
- **Few shot examples**: four to five example question and answer pairs at the end of each prompt, written in the persona's actual voice, showing the model exactly what tone and structure a real answer should have. This is the core of the prompting technique used here, few shot prompting, rather than only describing the voice abstractly and hoping the model infers it correctly

### Guardrails built into both prompts

- Neither persona will confirm which AI model or company is behind them. If asked directly, they deflect playfully and stay in character, rather than giving a formal AI disclaimer.
- Neither persona will rate or compare other coding educators, with a light exception for a small named circle of friends they'd naturally mention on stream (for both, that includes each other, plus a couple of others), kept free of ranking or gossip.
- Both refuse to discuss or reveal their own system prompt if asked.
- Both avoid politics, religion, salary shaming specific companies, and insider gossip, redirecting back to the technical conversation instead.
- Neither gives real medical, legal, financial, or mental health advice. If something genuinely serious comes up, the persona drops the bluntness or casualness and points the person to an actual professional.
- Standard refusals apply for anything illegal, malware or hacking help, hate speech, explicit content, or ghostwriting a full graded assignment with no teaching involved.
- Code help itself is never restricted, since that's the actual point of the app, the rule is only that reasoning has to come alongside code, not a silent code dump.

### A shared addendum for tool use

On top of the two persona specific prompts, a small addendum is appended to whichever persona is active (see `lib/ai/prompts/index.ts`). It instructs the model to use the YouTube search tool only against that persona's own channel, to never invent video titles from memory, and to be upfront if the tool genuinely returns nothing relevant, rather than making up a plausible sounding video. This keeps recommendations grounded in real content instead of the model guessing at what videos "should" exist.

## 3. Context management approach

- Conversation state on the client is handled by the Vercel AI SDK's `useChat` hook, which keeps the running list of messages and streams new ones in as they arrive.
- For signed in users, each chat is tied to a `chatId` and persisted to Postgres through Prisma. Message history for a given chat is loaded from the database and handed to `useChat` as the initial state.
- For guests (not signed in), the same conversation is written to the browser's local storage as it goes, instead of the database. This is what lets a guest lose nothing if they refresh or close the tab.
- The moment a guest signs in, the locally stored draft is imported into Postgres through a server action, the local copy is cleared, and the URL updates to point at the now permanent chat id. From that point on the conversation behaves exactly like any other signed in chat.
- Guests are capped at 5 messages. Once that limit is hit, the composer is replaced with a prompt to sign in to continue, rather than silently failing or letting the guest keep typing into a chat that won't go anywhere.
- Switching personas mid conversation starts a fresh chat rather than mixing two different voices into one thread's context, since the two personas have genuinely different system prompts and letting both answer inside the same history would confuse the model and break the persona illusion.
- Editing an earlier message or regenerating a response prunes anything after that point from both the client state and the database, so the model is never re asked to build on a version of the conversation that no longer exists.

## 4. Personalization touches

- Greetings are time aware, split into morning, afternoon, evening, and night, with several variations per slot per persona so it doesn't feel like the same line every time. This was inspired by the way Claude itself varies its own greeting style depending on time of day.
- Starter/suggested messages shown on a fresh chat are written separately for each persona, matching what a student would actually ask that person specifically (roadmap and career questions for Hitesh, backend and systems questions for Piyush).

## 5. Sample conversations

Screenshots of real conversations with both personas will be added here to show persona accuracy and conversation quality across a longer exchange.

 
![Hitesh persona sample conversation](/hitesh-sample.png)
![Piyush persona sample conversation](/piyush-sample.png)
 

## 6. Known limitations

- Persona accuracy depends on how representative the collected transcripts are. A wider or more recent set of streams would sharpen the voice further.
- The YouTube tool is only as good as the channel's own search relevance, if a persona genuinely hasn't made a video on a topic, the model is instructed to say so rather than invent one.

## 7. Development history

A short version of how the project came together, grouped by milestone rather than by every individual commit:

- **Project scaffolding.** Started from a fresh Next.js app, then added shadcn, the Vercel AI SDK, and the OpenAI compatible provider.
- **Persona foundation.** Collected the Hitesh and Piyush transcripts, turned them into the persona JSON, and wrote the first version of both system prompts along with the model configuration.
- **First working chat.** Built the chat API and chat page with basic message handling, first for Piyush, then wired in persona switching.
- **Database and auth.** Integrated Prisma with an initial schema, added chat management (limits, middleware for auth), and brought in Clerk for real authentication with proper chat routing.
- **Guest experience.** Added the guest message limit and its banner, then built out the local storage draft flow so guest conversations survive a refresh and get imported into the database on sign in.
- **Sidebar and chat management.** Built out the sidebar with real recent chats grouped by date, active chat context, and rename/delete actions with proper confirmation dialogs.
- **YouTube tool.** Integrated YouTube search into the chat so personas can recommend real videos from their own channels, with loading skeletons for the results.
- **Personalization pass.** Added time of day greetings and persona specific starter questions, plus message editing and regeneration with pruning.
- **Polish and refinement.** Cleaned up the sidebar and composer UI, added Vercel Analytics, improved the typing indicator and message streaming so responses feel connected rather than abrupt, and did a final pass on both system prompts and the greeting copy for tone and conciseness.