# AfterClass, project documentation

This document covers how AfterClass was built. It comes in two halves.

The first half is the newer work: an advanced retrieval pipeline that indexes a 22 hour Expo and React Native course and answers questions from it, pointing you at the exact module, chapter, and timestamp. The second half is the original assignment, the two personas of Hitesh Choudhary and Piyush Garg, how their voices were built, and how the app handles conversation state.

If you want the deeper engineering detail on the pipeline, including the bugs that shaped it, that lives in [RAG.md](./RAG.md).

---

# Part one, the course retrieval pipeline

## 1. What problem this solves

A learner watching a 22 hour course has a specific problem. They remember that something was explained, they cannot remember where, and scrubbing through video to find it is miserable. So the goal was not just "answer questions about the course". It was to answer the question properly, in the mentor's voice, and then hand over the exact place to go and watch it.

That last part sets the hard constraint for everything else. A citation that points at the wrong minute is worse than no citation, because the learner trusts it and wastes their time.

So there is one rule the whole system is built around:

> Subtitle text and timestamps are copied straight from the source files and never pass through a language model. Models only ever refer to lines by their index number.

A model that goes wrong can therefore group a topic badly, or cite the wrong clip. It cannot invent a timestamp that does not exist. That is the difference between a citation that is imperfect and one that is useless.

## 2. Two systems, not one pipeline

It helps to think of this as two separate systems that happen to share a database, because they have opposite constraints.

**Building the index** happens offline, once per subtitle change. It can take minutes, cost real money, and cache aggressively.

**Answering a question** happens inside a web request. It has a few seconds, fractions of a cent, and no useful caching, since a serverless instance shares nothing with the next one.

Almost every decision below follows from which side of that line it sits on. Enriching every chunk with a model written description is affordable only because it happens offline. Skipping retrieval for a greeting matters only because that happens online.

## 3. Building the index

The chain runs: subtitle files, then cues, then topic segments, then chunks, then enrichment, then embeddings, then storage.

**Parsing.** The `class-subtitle/` folder holds one folder per module and one per lesson, with a `.srt` or `.vtt` inside. Folder naming is inconsistent across modules, some use `01_`, some `1.`, some `chapter-1-`, some `mini-project-1-`, so the parser normalises all of it into a module number, a chapter number, a kind, and a readable title.

**Semantic segmentation.** A cheap model reads the numbered subtitle lines of a lesson and returns the line numbers where the topic changes. This produces segments of roughly two minutes rather than arbitrary fixed slices, so a segment tends to contain one complete idea.

**Two sizes, on purpose.** Each segment is then windowed into smaller chunks of about a minute. The chunks are what get embedded and searched, because a small match gives a precise timestamp. The segments are what the answering model actually reads, because a minute of speech is often half an explanation. Search finds a chunk, then the pipeline swaps in its parent segment before generating. You get the precision of small pieces and the context of large ones without having to choose.

**Contextual enrichment.** This is the single most valuable step in the whole build. Spoken language drops its nouns constantly. A chunk of transcript reads:

> "so now we just wrap this in the provider and it'll be available everywhere"

Nothing in that sentence says React, or Context, or Expo. Its embedding is close to useless. So before embedding, a model writes one sentence saying what the clip is about, and that sentence gets prepended. The same pass pulls out entity names like `expo-secure-store` or `useLocalSearchParams`, which feed keyword search later.

**Where it all goes.** Embeddings go to Qdrant. Everything else, the text, the structure, the full text search index, and the course catalog, goes to Postgres.

Anything the user will actually see, like module labels and chapter numbers, is read from Postgres at query time rather than copied into the vector payload. That means renaming a label is a database update instead of rebuilding every embedding.

**Re-running is cheap.** Each lesson stores a hash of its subtitle file, so unchanged lessons are skipped entirely. Model responses are cached on disk by their exact inputs. Vector IDs are derived deterministically from the chunk ID, so re-running updates in place instead of duplicating.

## 4. Answering a question

The pipeline is: route, transform, search, fuse, grade, maybe retry, then answer.

### Routing, which is also the guardrail

The first step decides what machinery the question actually needs. There are four outcomes:

- **Course**, the learner is pointing at the course, so run the full pipeline
- **Catalog**, the question is about the shape of the course rather than its content, so just read the lesson list
- **General**, an ordinary question, answered from the model's own knowledge with no retrieval
- **Refuse**, off topic, unsafe, or an attempt to override the instructions

Three of those four skip retrieval completely. "hi" should not cost five seconds and a pile of embedding calls.

Routing is also where the input guardrail lives, because deciding "what kind of question is this" and "is this question trying to hijack the assistant" are the same judgement, made once.

The default here was wrong at first, and worth explaining. The original rule was "treat any technical question as a course question". That sounds sensible and is the wrong product. This app is a general mentor that happens to have one course indexed, so that rule made "how do I use expo-router?" spend eight seconds on retrieval to answer something the model already knew, and made the whole assistant feel like it only knows one course. The line is now whether the learner referenced the course at all, not whether the course happens to cover the subject.

### Course mode

Guessing is only ever going to be approximately right, so the learner gets an explicit switch. Typing `/course` opens a small command menu and turns on a sticky mode, shown as a chip above the composer. Every message after that is course grounded until the chip is dismissed.

Course mode narrows routing, it does not skip it. The router is the safety check, and an explicit mode must not become a way around it, so it still runs on a version of the prompt that offers course, catalog, and refuse, plus general for pure pleasantries so that saying "thanks" doesn't trigger a search.

### Rewriting the question

The real problem in retrieval here is vocabulary mismatch. A learner asks "how do I save a login token". The instructor said "SecureStore dot setItemAsync". One phrasing is one shot at bridging that gap.

So one model call turns the question into four different searches:

- **Standalone**, the question with pronouns resolved from the conversation, because "how do I do that?" is unsearchable on its own
- **Step back**, a broader version of the question, which finds the instructor's setup and explanation rather than only the line that names the API
- **Sub questions**, the separate parts of a multi part question, so they don't retrieve as one blur
- **Hypothetical answer**, a short passage written as if it were the answer. Answers and questions are written differently, so embedding a fake answer lands closer to real answer text than embedding the question does

All four come from a single call rather than four. It is roughly a quarter of the latency, and the output is genuinely better, because writing them together lets the model make them complement each other instead of accidentally rephrasing the same thing.

### Two kinds of search, then fusion

Every query runs through two searches that fail in opposite directions.

Vector search understands that "save data on the phone" means AsyncStorage even though neither phrase matches. Keyword search nails exact names like `useLocalSearchParams`, where the embedding of a rare token is close to noise.

The two result lists are then combined with Reciprocal Rank Fusion. The trick in RRF is that it uses only a document's position in each list and throws the scores away. A vector similarity of 0.83 and a text rank of 0.0004 live on scales that cannot be compared, and normalising them would mean knowing the distribution of both. Positions are always comparable.

It also has a useful bias built in. Because the top few positions score almost the same, something that both searches found at a middling position beats something only one search found at the very top. Agreement wins, which is usually what you want.

Usually, but not always, which is why each search leg and each generated query carries its own trust weight. Keyword search is downweighted because it matches common words like "button" across dozens of lessons, and the learner's actual question is trusted more than any rewrite of it.

### Checking the results before answering

This is the part that stops confident nonsense. Retrieval failure is invisible at generation time. The model receives some transcript, and a fluent model will happily write a convincing answer from completely irrelevant transcript. You cannot tell that apart from success by reading the output.

So before generating anything, a cheap model scores the retrieved set out of ten and marks which pieces are genuinely relevant. The score maps to three outcomes:

- **Full coverage.** Answer from the excerpts and cite them.
- **Partial coverage.** The right topic, but not a complete answer. Answer from the mentor's own knowledge and still cite where the related material is.
- **No coverage.** Say the course does not cover this, which for a course assistant is a correct answer rather than a defeat.

That middle state was added after a real failure. Someone asked which is better, Pressable or TouchableOpacity. Retrieval worked perfectly and surfaced three Module 2 clips that teach Pressable. The grader scored them four out of ten, also correctly, because the course demonstrates both components but never actually declares a winner. With only two outcomes, four counted as a failure, the clips were thrown away, and the learner got a general answer with no timestamps for a topic the course teaches at 9:23. Comparisons land in that middle band constantly, because courses show things without ranking them.

When the score is in the middle and a retry looks worthwhile, the pipeline writes deliberately different queries and searches again, then fuses both attempts. Rephrasing a failed query just returns the same failed results, so the second attempt has to change the angle, not the wording.

## 5. Writing the answer

Each route gets only the instructions it needs added to the persona prompt, rather than one giant prompt carrying rules for every situation.

The citation mechanism is where the rule from section one gets enforced. The excerpts handed to the model deliberately contain no timestamps at all. A model that sees "12:04" in its context will eventually type "around 12:04" into its answer, and that sentence bypasses every check. Withholding it makes the citation marker the only way to refer to a moment, which is what makes the marker worth validating.

So the model writes `[1]`, and a filter running over the stream resolves it against the exact list of sources the model was given. Markers pointing at nothing get removed, surviving ones get renumbered in the order they were actually used, and markers split across two chunks of streamed text get held back until they are complete. Anything inside a code block is left alone, because `aspect: [1, 1]` is an array, not a citation.

A citation is addressed the way you would actually navigate the course:

```
Module 4 › Chapter 3: Dynamic Routes                     2:40
Creating a Dynamic Route File in VS Code · Suraj Jha
3-Dynamic Routes_epm
```

The folder name is printed underneath because the tidy title is not what a file browser shows. Three naming problems in the course made this fiddlier than expected. Module 3 contains both a chapter one and a mini project one, so the kind has to be part of the label. Two different folders are both module 1, so the one taught by Hitesh is labelled that way. Module 17's folders are literally named `chapter-1` with no topic in them, so the title is recovered from the transcript and shown next to the folder, one to understand and one to navigate by.

Persona and instructor are kept strictly separate throughout. The persona is whose voice answers. The instructor is who actually recorded the clip. Hitesh taught module 1, Suraj Jha taught the rest, and Piyush taught none of it, so each persona carries an explicit line about its real relationship to the course. A confident false claim of authorship was the most likely thing to go wrong here.

## 6. What the wait looks like

A course question spends around five seconds working before the first word appears. That is long enough that bouncing dots read as a broken page, so the pipeline reports what it is doing as it goes:

> Reading your question, then working out what to search for, then searching the transcripts, then found 12 clips in modules 3, 4 and 5, then putting it together.

Those progress messages are deliberately temporary and never saved into the conversation, since replaying "searching the transcripts" underneath a finished answer would be nonsense. Citations are the opposite and are saved with the message, so they survive a reload.

## 7. Known limitations of the pipeline

- The thresholds that decide "good enough", "partially relevant", and how much to trust each search leg were tuned on individual examples rather than measured. A set of around 25 known good questions with their expected lessons and timestamps would turn those guesses into numbers.
- Citations are text, not links. The lessons have no URLs yet, though the database already has a column waiting for them and the exact start time is already attached to every citation.
- The vector database and the Postgres database are hosted in different regions, so there is a round trip cost that no single deployment region can avoid. Timings are recorded per stage specifically so this can be measured in production rather than guessed at.

---

# Part two, the personas

## 8. How the persona data was collected and prepared

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

## 9. Prompt engineering strategy

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

### Route specific instructions on top of the persona

The persona prompt now carries the voice and nothing else. Task specific instructions are attached per route by `lib/ai/answer.ts`, so a refusal no longer ships a briefing for a tool it was never given, and a course answer carries citation rules that a casual chat has no use for.

The YouTube instructions are one example. They are attached only on the general route, where a "where do I learn this" question actually wants a video. They tell the model to search only that persona's own channel, never to invent video titles from memory, and to be upfront when the tool genuinely returns nothing rather than making up a plausible sounding video.

## 10. Context management approach

- Conversation state on the client is handled by the Vercel AI SDK's `useChat` hook, which keeps the running list of messages and streams new ones in as they arrive.
- For signed in users, each chat is tied to a `chatId` and persisted to Postgres through Prisma. Message history for a given chat is loaded from the database and handed to `useChat` as the initial state.
- For guests (not signed in), the same conversation is written to the browser's local storage as it goes, instead of the database. This is what lets a guest lose nothing if they refresh or close the tab.
- The moment a guest signs in, the locally stored draft is imported into Postgres through a server action, the local copy is cleared, and the URL updates to point at the now permanent chat id. From that point on the conversation behaves exactly like any other signed in chat.
- Guests are capped at a small number of messages. Once that limit is hit, the composer is replaced with a prompt to sign in to continue, rather than silently failing or letting the guest keep typing into a chat that won't go anywhere.
- Switching personas mid conversation starts a fresh chat rather than mixing two different voices into one thread's context, since the two personas have genuinely different system prompts and letting both answer inside the same history would confuse the model and break the persona illusion.
- Editing an earlier message or regenerating a response prunes anything after that point from both the client state and the database, so the model is never re asked to build on a version of the conversation that no longer exists.
- When a course answer is saved, its citations are saved with it as part of the message, so reopening an old chat still shows you where each answer came from. The progress messages shown while waiting are deliberately not saved.

## 11. Personalization touches

- Greetings are time aware, split into morning, afternoon, evening, and night, with several variations per slot per persona so it doesn't feel like the same line every time. This was inspired by the way Claude itself varies its own greeting style depending on time of day.
- Starter messages on a fresh chat mix two course questions with two persona questions, so the course capability is visible without the screen turning into a course advert. Every course starter names the course explicitly, which is not just phrasing, since a starter worded as a plain technical question would be answered from general knowledge and quietly fail to show off the feature it exists to advertise.
- The greeting and the starters are chosen after the page loads rather than while it renders. Choosing randomly during rendering made the server and the browser disagree, and React responds to that by throwing away the server rendered version of that whole section.

## 12. Sample conversations

![Hitesh persona sample conversation](https://afterclass.thesidharth.com/hitesh-sample.png)
![Piyush persona sample conversation](https://afterclass.thesidharth.com/piyush-sample.png)

## 13. Known limitations of the personas

- Persona accuracy depends on how representative the collected transcripts are. A wider or more recent set of streams would sharpen the voice further.
- The YouTube tool is only as good as the channel's own search relevance. If a persona genuinely hasn't made a video on a topic, the model is instructed to say so rather than invent one.

## 14. Development history

A short version of how the project came together, grouped by milestone rather than by every individual commit.

The persona half came first:

- **Project scaffolding.** Started from a fresh Next.js app, then added shadcn, the Vercel AI SDK, and the OpenAI compatible provider.
- **Persona foundation.** Collected the Hitesh and Piyush transcripts, turned them into the persona JSON, and wrote the first version of both system prompts along with the model configuration.
- **First working chat.** Built the chat API and chat page with basic message handling, first for Piyush, then wired in persona switching.
- **Database and auth.** Integrated Prisma with an initial schema, added chat management, and brought in Clerk for real authentication with proper chat routing.
- **Guest experience.** Added the guest message limit and its banner, then built out the local storage draft flow so guest conversations survive a refresh and get imported into the database on sign in.
- **Sidebar and chat management.** Built out the sidebar with real recent chats grouped by date, active chat context, and rename and delete actions with proper confirmation dialogs.
- **YouTube tool.** Integrated YouTube search into the chat so personas can recommend real videos from their own channels, with loading skeletons for the results.
- **Personalization pass.** Added time of day greetings and persona specific starter questions, plus message editing and regeneration with pruning.
- **Polish and refinement.** Cleaned up the sidebar and composer UI, added Vercel Analytics, and improved the typing indicator and message streaming so responses feel connected rather than abrupt.

Then the course half:

- **Reading the course.** Wrote the subtitle parser and the catalog loader that makes sense of inconsistent folder naming across seventeen modules.
- **Splitting it up.** Added semantic segmentation, the smaller chunk windows inside each segment, and the enrichment step that gives every chunk a description and a set of entity names.
- **Storage.** Set up Qdrant for embeddings and extended the Postgres schema with the course tables and a full text search index, then wrote the ingestion script that ties it all together.
- **Hybrid search.** Built vector search and keyword search as separate legs and combined them with weighted rank fusion.
- **Query understanding.** Added the four way router and the query rewriting step that turns one question into several complementary searches.
- **Checking the work.** Added the grading step that scores retrieved results before answering, with a bounded retry that searches again from a different angle.
- **Answering with citations.** Built the answer step, the streaming citation validator, and the citation cards, then addressed citations as module, chapter, and timestamp with the folder name alongside.
- **Wiring it into the app.** Streamed the pipeline's progress into the chat UI and persisted citations with each message.
- **Course mode.** Added the `/course` slash command and reworked the routing default so ordinary technical questions are answered normally instead of always going through retrieval.
