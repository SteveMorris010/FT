# FoodTech Study

A study platform for university Food Technology students. Upload your lecture
slide decks (`.pptx`) and work through them with four focused study modes. The
explanations stay at a proper university level and use correct terminology; they
are never dumbed down.

The app runs fully on your own machine with a local database, and most of it
works with **no AI key at all**. An optional, free Google Gemini key unlocks the
AI-assisted features (see [AI setup (optional, free)](#ai-setup-optional-free)).

---

## The four study modes

Every mode operates on a single lecture that you have uploaded.

1. **Summarize** — turns a lecture deck into a structured, university-level
   summary in Markdown (headings, key definitions with correct terminology,
   processes, important values, and a short glossary). Good for fast revision.
2. **Understand** — a grounded Q&A chat. Ask questions about a lecture and get
   precise, terminology-correct explanations based only on that lecture's slide
   text, with the conversation history kept for continuity.
3. **Practice** — flashcards and exercises. Flashcard **review** (flip, navigate,
   self-rate Again/Good) and exercise **reveal-answer** work offline on cards
   that already exist. **Generating** new flashcards/exercises uses AI.
4. **Examine** — a timed mock exam built from the lecture's stored exercises.
   Pick how many questions and how long, watch the countdown, then submit (or
   let it time out) to get a score and detailed per-question feedback. The
   timer, scoring, and feedback are pure logic and need no AI key.

---

## Tech stack and why

This project is intentionally built from mainstream, well-documented tools so the
code is approachable if you are still learning. Here is what each piece is and
why it was chosen:

| Tool | What it is | Why it is here |
| --- | --- | --- |
| [Next.js 16](https://nextjs.org/) (App Router) | A React framework that handles both pages and the backend API in one project | One codebase for the UI and the server logic; no separate backend to run |
| [React 19](https://react.dev/) | The UI library | Industry standard, huge amount of learning material |
| [TypeScript](https://www.typescriptlang.org/) | JavaScript with types | Catches mistakes before you run the app and makes the code self-documenting |
| [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first CSS | Lets you style directly in the markup and keeps the look consistent |
| [Prisma](https://www.prisma.io/) + [SQLite](https://www.sqlite.org/) | A type-safe database toolkit and a zero-setup file database | SQLite is a single file on disk, so there is no database server to install |
| [@google/genai](https://www.npmjs.com/package/@google/genai) | The official Google Gemini SDK | Powers the AI features; Gemini has a genuinely free tier |
| [JSZip](https://stuk.github.io/jszip/) + [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | Read ZIP files and parse XML | A `.pptx` file is just a ZIP of XML, so these extract slide text offline |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs) | Password hashing | Stores passwords safely (never in plain text) |
| [zod](https://zod.dev/) | Runtime validation | Checks that incoming data (forms, AI output) has the shape we expect |
| [Vitest](https://vitest.dev/) | Test runner | Fast unit tests for parsing, AI fallback, and exam scoring |

A deliberate design choice: **all AI access goes through one file**,
`src/lib/ai/provider.ts`. Nothing else in the app talks to the Gemini SDK
directly. That is why a missing key is handled in a single place and the rest of
the app never crashes without one.

---

## Prerequisites

- **[Node.js 22](https://nodejs.org/)** (or newer) and npm. Check with:

  ```bash
  node --version
  ```

That is all you need. SQLite ships with Prisma, so there is no database to
install separately.

---

## Install and run

From the project root:

```bash
# 1. Install dependencies (also runs `prisma generate` automatically)
npm install

# 2. Create your local environment file
cp .env.example .env

# 3. Create the SQLite database and apply the schema
npx prisma migrate dev --name init

# 4. Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> The app works right away after these steps. AI features stay disabled (with a
> friendly message) until you add a key, which is explained next.

---

## AI setup (optional, free)

**You do not need an API key to use the app.** Without one, uploading decks,
reading slide text, your library, flashcard review, and the exam
timer/scoring/feedback all work. AI-only features show a clear "AI features are
not configured" panel instead of breaking anything.

To turn on the AI features, get a **free** Google Gemini key. No credit card is
required.

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and sign in with
   a Google account.
2. Click **Create API key** (you can create one in a new or existing project).
3. Copy the key that is shown.
4. Open your `.env` file and paste the key into `GEMINI_API_KEY`:

   ```bash
   GEMINI_API_KEY="paste-your-key-here"
   ```

5. (Optional) Choose a different model with `GEMINI_MODEL`. The default is
   `gemini-2.0-flash`, which is fast and on the free tier:

   ```bash
   GEMINI_MODEL="gemini-2.0-flash"
   ```

6. **Restart the app** (stop `npm run dev` and start it again) so it picks up the
   new environment values.

### Which features need a key?

| Feature | Needs a key? |
| --- | --- |
| Register / log in / log out | No |
| Create a subject | No |
| Upload and parse a `.pptx` deck | No |
| Read extracted slide text / browse library | No |
| Flashcard **review** (on existing cards) | No |
| Exam **timer, scoring, and feedback** (on existing exercises) | No |
| **Summarize** a lecture | Yes |
| **Understand** (AI chat) | Yes |
| **Generate** flashcards | Yes |
| **Generate** exercises | Yes |

---

## Usage walkthrough

1. **Register.** Open [http://localhost:3000](http://localhost:3000), choose
   **Get started** / **Sign in**, and create an account with an email and
   password. You are redirected to your library.
2. **Create a subject.** In the library, use the **New subject** form to add a
   subject (for example, "Food Chemistry" or "Food Microbiology").
3. **Upload a lecture.** Inside a subject, use the upload form to add a lecture
   slide deck. Pick a `.pptx` file, optionally give it a title, and upload. The
   app parses the slides offline and saves the extracted text.
4. **View the extracted slides.** Open the lecture to see its title, slide count,
   and the text pulled from each slide (expand a slide to read it).
5. **Use each mode** from the lecture page:
   - **Summarize** — click Generate (needs a key) to produce a structured
     summary; Regenerate to refresh it.
   - **Understand** — type questions in the chat and get grounded answers
     (needs a key).
   - **Practice** — review flashcards and reveal exercise answers (works
     offline on existing content); generate new cards/exercises (needs a key).
   - **Examine** — set a question count and time limit, take the timed exam, and
     review your score and per-question feedback (works offline on existing
     exercises).

### File format: `.pptx` only

Modern PowerPoint `.pptx` files are **fully supported**. The legacy binary
`.ppt` format is a completely different file structure and is **rejected** with a
message asking you to re-save (export) the file as `.pptx` from PowerPoint or
your slide tool. Google Slides and LibreOffice Impress can also export `.pptx`.

---

## Project structure

```
prisma/                     Database schema and migrations
  schema.prisma             Models: User, Subject, Lecture, Slide, Summary,
                            Flashcard, Exercise, ExamAttempt, ChatMessage
  migrations/               Versioned SQL migrations (dev.db is created from these)

src/
  app/                      Pages and backend API (Next.js App Router)
    page.tsx                Landing page
    layout.tsx              App shell (top nav + page container)
    (auth)/                 Register and login pages
    library/                Your subjects and lectures, plus subject/upload actions
    lectures/[id]/          Lecture detail page and the four per-lecture modes
                            (summarize, understand, practice, examine)
    api/                    Route handlers: auth, upload, summarize, chat,
                            flashcards/exercises generation, exam grading

  lib/
    db.ts                   Prisma client singleton (safe across hot reloads)
    auth.ts                 Password hashing + signed cookie sessions
    pptx.ts                 Offline .pptx slide-text extractor (JSZip + XML)
    exam.ts                 Pure exam scoring and feedback (no AI)
    validation.ts           zod schemas for form input
    ai/
      provider.ts           The ONLY file that talks to the Gemini SDK;
                            exposes isAIConfigured() and generateText()
      prompts.ts            University-level prompt templates + slide context builder
      parse.ts              Validates/cleans the AI's JSON output (zod)

  components/               Shared UI: TopNav, Markdown renderer, AiNotConfigured panel
  generated/prisma/         Auto-generated Prisma client (do not edit; regenerated)

tests/                      Vitest unit tests (pptx parsing, AI fallback,
                            AI JSON parsing, exam scoring)
```

---

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server at [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Build the production bundle |
| `npm start` | Run the production build (run `npm run build` first) |
| `npm run lint` | Run ESLint |
| `npm test` | Run the unit tests once with Vitest |
| `postinstall` | Runs automatically after `npm install` to generate the Prisma client |

---

## Known limitations

- **Legacy `.ppt` is not supported.** Only modern `.pptx` files are accepted;
  re-save old `.ppt` files as `.pptx` first.
- **Image-only decks have little to work with.** The parser reads text, not
  images. If a slide's content is entirely pictures (no text boxes), the AI
  modes have nothing to ground on and will tell you the deck has too little text.
- **AI output quality depends on inputs.** Summaries, chat answers, and
  generated questions are only as good as the slide text and the chosen model.
  The free tier also has rate limits, so heavy use may be throttled by Google.
- **Local, single-user-friendly storage.** Data lives in a local SQLite file
  (`prisma/dev.db`). It is great for one student on one machine but is not set up
  for large multi-user or production hosting.

---

## Troubleshooting

- **"Table does not exist" or the database seems empty.** The database was not
  created or migrated. Run:

  ```bash
  npx prisma migrate dev --name init
  ```

- **An "AI features are not configured" panel appears.** That mode needs a key.
  Add `GEMINI_API_KEY` to your `.env` file and restart the app. See
  [AI setup (optional, free)](#ai-setup-optional-free).

- **Changes to `.env` do not take effect.** Stop the dev server and start it
  again; environment variables are read at startup.
