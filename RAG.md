# The course RAG pipeline

AfterClass can answer questions about a 22-hour Expo / React Native course by
explaining the concept in the persona's voice and then pointing at the exact
lesson and timestamp where it is taught.

This document explains how, and more importantly *why* each piece is there. Most
of the design exists because something simpler was tried first and failed in a
specific, observable way. Those failures are in here too, and they are the part
worth reading.

---

## 0. The one invariant

Everything else is negotiable. This is not:

> **Cue text and timestamps are copied verbatim from the `.srt` file and never
> pass through a language model. Models only ever emit cue *indices*.**

A model that hallucinates can therefore group a topic wrongly, or cite the wrong
moment. It can never produce a timestamp that does not exist in the source file.

That is the difference between a citation that is imperfect and one that is
worthless, and it is why the answer step is never shown a timestamp at all.
See §2.6.

---

## 1. Two systems, not one

RAG is usually drawn as one pipeline. It is really two, with completely
different constraints:

| | **Ingest** (offline) | **Query** (in the request) |
|---|---|---|
| Runs | once per subtitle change | on every message |
| Budget | minutes, dollars | seconds, fractions of a cent |
| Caching | aggressive, on disk | none possible |
| Model | can be slow | must be fast |

Conflating them is the most common way to end up with something that is either
too dumb (because ingest was rushed to keep queries fast) or too slow (because
query-time work belongs in ingest). Almost every decision below follows from
which column it sits in.

---

## 2. Ingest (`scripts/ingest.ts`)

```
.srt files → cues → segments → chunks → enrichment → embeddings → Postgres + Qdrant
```

Measured on the real corpus: **87 lessons → 687 segments → 1,702 chunks, 410
seconds, about $0.11.** A re-run with the LLM cache warm is ~120s, since only the
embeddings have to be recomputed.

### 2.1 Parsing (`lib/rag/parse-srt.ts`)

Handles both `.srt` and `.vtt` (they differ mainly in whether the millisecond
separator is `,` or `.`).

**What broke:** the first parser appended the *next* cue's sequence number to the
*previous* cue's text, because it decided "is this line a sequence number?" by
checking whether the current cue's text was still empty. Fixed by looking ahead:
a line is a sequence number only if the line after it is a timing line.

**Lesson:** in a line-oriented format, decide what a line *is* from its context,
not from accumulated state.

### 2.2 Semantic segmentation (`lib/rag/segment.ts`)

A cheap model reads the numbered cues and returns the indices where the topic
changes. Target ~2 minutes, floor 45s, ceiling 4 minutes.

**What broke, twice:**

1. A 7-second segment survived. The merge check measured the gap between block
   *starts*, which is the length of the *previous* block, so the final block was
   never checked. Fixed with an explicit `blockMs()` and a fixpoint merge loop.
2. A 335-second segment survived a 240-second ceiling. The code ran
   `mergeUndersized(splitOversized(...))`. Splitting can never create a block that
   is too short, but merging can absolutely create one that is too long. Only
   `splitOversized(mergeUndersized(...))` converges.

**Lesson:** when you compose two normalising passes, ask which one can undo the
other. That determines the order, and there is usually only one correct answer.

### 2.3 Small-to-big (parent document retrieval)

Two different sizes, for two different jobs:

- **Chunk (~60s)**: what gets embedded and searched. Small, so a match is
  precise, which is what makes the timestamp precise.
- **Segment (~2-4 min)**: what the answering model actually reads. Big enough to
  contain the explanation rather than a fragment of one.

Retrieval finds a chunk; `expandToSegments()` swaps in its parent before
generation. You get the precision of small chunks and the context of large ones
without choosing.

### 2.4 Contextual retrieval (`lib/rag/enrich.ts`)

Spoken language drops its nouns. A transcript chunk reads:

> "so now we just wrap this in the provider and it'll be available everywhere"

Nothing in that sentence says React, Context, or Expo. Its embedding is close to
useless.

So before embedding, a model writes **one situating sentence** per chunk, which
gets prepended:

> *This clip is from Module 6 on global state, explaining how to wrap the app in
> a React Context provider.* "so now we just wrap this in the provider…"

This is Anthropic's Contextual Retrieval technique. It is the single highest-value
thing in the ingest stage, and it is only affordable because ingest is offline.

The same pass extracts entity **tags** (`expo-secure-store`, `useLocalSearchParams`)
which feed the keyword leg in §3.3.

### 2.5 Two stores, on purpose

| Store | Holds | Answers |
|---|---|---|
| **Qdrant** | 1,536-dim embeddings (`text-embedding-3-small`) | "what *means* this?" |
| **Postgres** | text, `tsvector`, structure | "what *says* this?" + "what is the course shaped like?" |

Postgres also owns the course outline, which is what CATALOG questions read
instead of doing any search at all.

**Postgres is authoritative for anything displayed.** The Qdrant payload
deliberately does not carry module labels, chapter numbers or folder names.
Copying them in would mean a re-embed every time a label changes, and it had
already caused a real inconsistency: the dense leg carried the raw folder `title`
in its payload while the keyword leg selected `displayTitle`, so the same lesson
was labelled differently depending on which leg found it. `loadLessonRefs()` now
joins those fields from Postgres for the handful of chunks that survive fusion,
which is one query and one source of truth.

**What broke:** the `tsvector` is a Postgres *generated column*, which requires
every function in its expression to be immutable. It failed. I assumed
`to_tsvector('english', …)` was the culprit, the usual suspect. An empirical
probe proved that fine and the real culprit was `array_to_string` over the tags
array. Fixed by denormalising to plain `tagsText` / `topicsText` columns.

**Lesson:** when the error names a class of thing ("not immutable"), test which
member is actually guilty before rewriting around your guess.

### 2.6 Idempotent re-ingest

Each lesson stores a `contentHash` of its source file. Unchanged file, no work.
Qdrant point IDs are a deterministic `sha256 → UUID` of the chunk ID, so re-running
upserts in place instead of duplicating. LLM responses cache to `.rag-cache/` keyed
by model + prompt + schema, so a re-run after a code change replays for free.

---

## 3. Query (`lib/rag/pipeline.ts`)

```
        ┌─ route ─┐
question┤         ├→ retrieve → grade →[retry once]→ expand → answer → validate
        └transform┘
```

### 3.1 Routing (`lib/rag/router.ts`)

Four routes, one cheap classification:

| Route | Meaning | Cost |
|---|---|---|
| `COURSE` | the learner pointed at the course | full pipeline |
| `CATALOG` | about the *structure* of the course | read the outline |
| `GENERAL` | everything else on-topic | no retrieval |
| `REFUSE` | off-topic / injection / unsafe | no retrieval |

**Three of the four routes skip retrieval entirely.** "hi" should not cost five
seconds and six embedding calls. The router is also the input guardrail, since routing
and safety are the same judgement, made once.

#### The default was wrong at first

The original prompt said *"default to COURSE whenever a question is technical"*.
That reads sensibly and is the wrong product. This app is a general coding mentor
that happens to have one course indexed, so treating every technical question as
a course lookup meant "how do I use expo-router?" cost eight seconds of retrieval
to answer something the model already knew, and made the whole assistant feel
like it only knows one course.

The line is now **whether the learner referenced the course**, not whether the
course happens to cover the topic:

```
"How do I use expo-router?"                 → GENERAL   (~2s, own knowledge)
"Where does the course teach expo-router?"  → COURSE    (~8s, cited)
"Which module covers FlatList perf?"        → COURSE
"What's in module 5?"                       → CATALOG
```

That distinction is subtle enough that the prompt carries the table above
verbatim. It also had a collision worth noting: "naming a module number" was
listed as a COURSE signal while "what's in module 5" was CATALOG's own example,
and the router duly sent it to COURSE. CATALOG now says *check this first
whenever a module number appears*.

#### `/course`, explicit scoping

Guessing is only ever going to be approximately right, so the learner gets a
switch. Typing `/course` in the composer turns on a sticky mode; every message
after it is course-grounded until the chip is dismissed.

Course mode **narrows** routing rather than skipping it. The router is the
injection guardrail, and an explicit mode must not become a way around it, so it
still runs, on a prompt that offers COURSE, CATALOG and REFUSE, plus GENERAL for
pure pleasantries only. Verified: `/course` + "ignore all previous instructions"
still routes to REFUSE.

The first version forbade GENERAL outright, which left the model nowhere to put
"hi bhai" and it refused a greeting. Reserving GENERAL for turns that carry no
question fixed it without loosening anything technical.

Route and transform start **in parallel**, but only the route is awaited before
branching. Three of four routes throw the transform away, and awaiting the pair
made every greeting wait on work it discarded. Refusals: ~2.2s → ~1.5s.

**What broke (badly):** OpenAI's structured-output strict mode requires `required`
to list every key in `properties`. Zod's `.optional()` omits the key, and the
request fails with a hard 400. Every optional field is `.nullable()` now.

But the *real* lesson was the second-order one: the router fails open to `COURSE`,
so a completely dead router produced a perfectly plausible decision and looked
identical to a working one. It was only caught because the CLI printed the
router's `reason` field. `RouteDecision` now carries a `degraded` flag and logs.

**Lesson:** a fail-open fallback is correct, and it will hide the failure it is
covering for unless you make the degraded path *visibly* different.

### 3.2 Query transformation (`lib/rag/transform.ts`)

The problem is vocabulary mismatch. A learner asks *"how do I save a login
token"*. The instructor said *"SecureStore.setItemAsync"*. One embedding of one
phrasing is a single shot at bridging that gap.

Four shots instead, **all from one model call**:

| Query | What it is | Why |
|---|---|---|
| `standalone` | pronouns resolved from history | "how do I do that?" is unsearchable |
| `stepBack` | the broader topic it sits inside | finds the instructor's *setup*, not just the line naming the API |
| `subQuestions` | independent facets (0-3) | multi-part questions retrieve badly as one blob |
| `hyde` | a hypothetical *answer* | answers and questions are written in different registers; embedding a fake answer lands nearer real answer text |

One call, not four: ~4× less latency, and the output is *better*, because writing
them together lets the model make the sub-questions genuinely complementary
instead of accidental paraphrases.

HyDE runs **dense-only**. It is a paragraph; OR-joining its ~40 terms into the
keyword leg would recreate exactly the common-word noise that §3.4 had to fix.

### 3.3 Hybrid retrieval (`lib/rag/retrieve.ts`)

Two legs that fail in opposite directions:

- **Dense** (Qdrant, cosine) understands that "save data on the phone" means
  AsyncStorage without either phrase matching.
- **Keyword** (Postgres `tsvector`) nails `useLocalSearchParams`, where the
  embedding of a rare token is close to noise.

**What broke (the biggest silent failure in the project):** the keyword leg
returned **zero rows for every query**. `websearch_to_tsquery` ANDs its terms, so
"how do I read the id from a dynamic route" became
`'read' & 'id' & 'dynam' & 'rout'`, and no single 60-second chunk contains all
four stems. Hybrid search was quietly dense-only for days.

It was caught only because the CLI printed per-result markers showing *which leg*
found each hit, and every line said `D#/K–`. Fixed with a hand-built OR-joined
`to_tsquery`.

**Lesson:** an empty result set is indistinguishable from a working component that
found nothing. Instrument *which* subsystem produced each result, or you cannot
tell the difference.

### 3.4 Reciprocal Rank Fusion

```
score(d) = Σ  weight / (K + rank(d))          K = 60
        legs
```

**RRF uses only a document's position in each list, never its score.** That is the
whole trick: a cosine similarity of `0.83` and a `ts_rank` of `0.0004` live on
incomparable scales, and normalising them would require knowing the distribution
of both. Ranks are always comparable.

K dampens the top: rank 0 contributes `1/60`, rank 1 contributes `1/61`, which is nearly
equal. So a document found by *both* legs at middling rank outscores one found by
a single leg at rank 0. **That agreement bias is the property you actually want.**

**What broke:** for *"make the phone vibrate when user taps"*, the correct Haptics
clip was found by dense alone at rank 0. A wrong Notifications clip was found by
keyword alone at rank 0, matching on "phone", "user", "tap". Both scored exactly
`1/60` and tied.

Fixed with per-leg trust weights: `DENSE_WEIGHT = 1.0`, `KEYWORD_WEIGHT = 0.5`.
A rank-0 hit from a noisy leg should not equal a rank-0 hit from a reliable one.

Every query from §3.2 also carries its own weight (`standalone` 1.0, `hyde` 0.8,
`subQuestion` 0.7, `stepBack` 0.5). The user's actual question is ground truth,
everything else is inference about what they meant.

### 3.5 Corrective RAG (`lib/rag/grade.ts`)

Before generating, a cheap model scores the retrieved set 0-10 and marks which
chunks are actually relevant.

The score maps to **three** outcomes, not two:

| Score | Coverage | What the answer step does |
|---|---|---|
| 6-10 | `full` | answer from the excerpts, cite them |
| 4-5 | `partial` | answer from own knowledge, **still cite** |
| 0-3 | `none` | say the course doesn't cover it |

The middle band was originally folded into "insufficient", and that was a real
bug. Asked *"which is better, Pressable or TouchableOpacity?"*, retrieval did its
job, since the retry loop surfaced three Module 2 clips that teach Pressable, and the
grader scored them **4**, correctly: the course demonstrates both components but
never delivers a head-to-head verdict, so the excerpts genuinely do not answer
the question *as asked*. Being below the threshold, those clips were dropped and
the learner got a general answer with **no timestamps**, despite the course
covering the topic at 9:23.

4-5 is exactly the band the rubric calls *"the right topic area, but the specific
thing asked is not shown"*. Comparisons and judgement calls land there constantly,
because courses demonstrate things without ranking them. The right response is to
answer the question properly and *also* point at what the course does teach.

Why this matters: **retrieval failure is invisible at generation time.** The model
gets *some* transcript, and a fluent model will write a confident answer from
irrelevant transcript. Grading turns a silent failure into either a retry or an
honest "the course doesn't cover this", which for a course assistant is a
correct answer rather than a defeat.

One call does both jobs. Per-document grading is the textbook form but costs N
calls; asking for relevant *indices* gets the same filtering for one.

**Retries only fire in the middle band (3-5).** A retry costs ~3.8s. Asked about
RevenueCat in-app purchases, retrieval scored **1/10** with hits scattered across
modules 5, 7, 13 and 14, which is the signature of a topic that is simply absent, where no
rewording helps. Skipping the retry there cut that path from **9.2s → 5.6s**.

When a retry does fire, `refineQueries()` writes *deliberately divergent* queries
at higher temperature, because rephrasing a failed query returns the same failed
results. Results from both passes are then fused with RRF rather than replaced,
since the first pass was rarely worthless, just incomplete.

### 3.6 Answering and citation validation (`lib/ai/answer.ts`, `lib/rag/citations.ts`)

Each route gets **only its own rules** appended to the persona prompt, rather than
one prompt carrying every addendum. A refusal no longer ships a briefing for a
tool it was not given.

A citation addresses a moment the way a learner navigates the course folder,
as **module → chapter → timestamp**, with the directory name printed underneath,
because the prettified title drops the number prefix and the `_epm` suffix and so
does not match what a file browser lists:

```
1   Module 4 › Chapter 3: Dynamic Routes                        2:40
    Creating a Dynamic Route File in VS Code · Suraj Jha
    3-Dynamic Routes_epm
```

Three naming problems the folder tree forces:

- Module 3 contains both `1. introduction to navigation` and
  `mini-project-1-init-project-setup`, so a bare number is ambiguous. The kind is
  part of the label: `Chapter 1` vs `Mini-project 1`.
- `module 1` and `module 1 hc` are both module 1. The second renders as
  **Module 1 (Hitesh)**, which is also the honest answer to "who taught this".
- Module 17's folders are literally `chapter-1_epm` with no topic in the name.
  The title is backfilled from the transcript, so the citation shows
  `Chapter 1: AI Story Generator App Setup` *and* the folder, one to understand
  and one to navigate by.

The citation mechanism is where §0 gets enforced:

1. Sources are rendered for the prompt **with no timestamps in them**. A model
   that sees "12:04" will eventually type "around 12:04", and that string bypasses
   every check. Withholding it makes the marker the *only* way to refer to a
   moment.
2. The model writes `[1]`, `[2]`.
3. A streaming filter validates each marker against the exact list the model was
   shown, dropping markers pointing at nothing, renumbering survivors by order of
   first use, and holding back markers split across delta boundaries.

**What broke, twice, both found by running it rather than reading it:**

1. `aspect: [1, 1]` inside a code block was rewritten to `[1][2]`, producing code
   that does not run. Code spans, fenced and inline, are now exempt.
2. `]` was in the "this is array subscript, not a citation" set, added so
   `m[0][1]` would survive. But `[1][2]` has that exact shape, and it is the form
   the prompt *asks for*. Every citation after the first was silently unresolved.

**Lesson:** a validator that rewrites its input needs tests for the things it must
*not* touch, not just the things it must catch.

Persona and instructor are kept strictly apart. The **persona** is whose voice
answers; the **instructor** is who recorded the clip. Hitesh taught Module 1;
Suraj Jha taught the rest; Piyush taught none of it. Each persona carries an
explicit line about its real relationship to the course, because a confident
false claim of authorship is the most likely thing to go wrong.

---

## 4. Streaming to the UI (`app/api/chat/route.ts`)

A course question spends ~5s before the first token. The fix is not to make it
faster (it is already parallel); it is to stop the wait looking broken.

The pipeline emits an event per stage, mapped to a status line by
`lib/rag/status.ts` and streamed as a **transient** data part:

> Reading your question… → Working out what to search for… → Searching the
> transcripts… → Found 12 clips in modules 3, 4, 5… → Putting it together…

**Transient vs persisted is the whole design in one line.** Transient parts fire
`onData` and never enter the message, so progress drives the waiting state and
then disappears, since replaying "Searching the transcripts…" under a finished answer
would be nonsense. Citations are **not** transient, so they persist in
`message.parts` and survive a reload with no extra storage.

Two exits from the route, chosen by whether there is anything to validate. Routes
with sources stream text manually so every delta passes the citation filter.
Routes without merge the model stream whole, because the text-only path would drop
the YouTube tool parts that `GENERAL` depends on.

---

## 5. The numbers

**Query latency, warm** (Frankfurt Qdrant, Singapore Neon, laptop):

| Stage | ms |
|---|---|
| route | 1349 |
| transform | 332 *(ran in parallel with route)* |
| retrieve | 1706 |
| grade | 1523 |
| expand | 114 |
| **retrieval total** | **5028** |
| first answer token | ~8000 |
| complete answer | ~20000 |

Cold start roughly doubles it, because both databases have to wake up.

**Models.** `gpt-4.1-nano` for everything mechanical (segment, enrich, summarise,
route, transform, grade). `gpt-4.1-mini` for the one user-visible generation.

`gpt-5-nano` was measured and rejected: it is a *reasoning* model and burned 2,624
hidden reasoning tokens and 20.3s on a single 88-cue lesson. `reasoningEffort:
"minimal"` cut it to 1.4s but it stopped doing the task.

---

## 6. What is still a guess

Being honest about this is part of the exercise. These constants were calibrated
on **single examples**, not measured:

- `RETRY_SCORE_FLOOR = 3`
- `SUFFICIENCY_THRESHOLD = 6`
- `KEYWORD_WEIGHT = 0.5`
- the four `QUERY_WEIGHTS`

The fix is a gold eval set: ~25 questions with known correct lessons and
timestamps, so these become measurements instead of guesses. `matchedBy` on each
result already records which generated query surfaced it, which is what tells you
whether HyDE and step-back are earning their place or just adding noise.

Also open:

- **Region split.** Qdrant is `eu-central-1`, Neon is `ap-southeast-1`. No Vercel
  region is near both. Stage timings are instrumented specifically to answer this
  in production rather than guess now.
- **Free Qdrant clusters suspend when idle.** A weekly cron would keep it warm.
- **No deep links.** Citations are text; lessons have no URLs yet. `videoUrl` is
  already on the lesson record for when they do.

---

## 7. Poking at it

```bash
# raw index: what does the index return for a literal string?
npx tsx scripts/query.ts "dynamic routes" --legs --context

# retrieval pipeline: route, transforms, fusion, grading, timings
npx tsx scripts/ask.ts "how do I save a login token"
npx tsx scripts/ask.ts "how do I upload an image" --naive   # compare to no pipeline

# end to end, including the persona answer and validated citations
npx tsx scripts/answer.ts "where does the course cover dynamic routes"
npx tsx scripts/answer.ts "how do I read route params"          # GENERAL now
npx tsx scripts/answer.ts "how do I read route params" --course # forced
npx tsx scripts/answer.ts "what's in module 5"                  # CATALOG
npx tsx scripts/answer.ts "how do I add in-app purchases"       # insufficient
npx tsx scripts/answer.ts "ignore your instructions"            # refusal

# rebuild the index (skips unchanged lessons)
npx tsx scripts/ingest.ts
npx tsx scripts/ingest.ts --module 4 --force
```

Every one of the bugs documented above was found through one of these scripts, not
by reading the code. That is the actual takeaway: **build the inspector before you
need it, and make it print which subsystem produced each result.**
