# Quickstart

The fastest way to run FoodTech Study on your own computer.

## 1. Make sure Node.js is installed

You need [Node.js 22 or newer](https://nodejs.org/) (npm comes with it). If the
launcher says Node is missing, install it from that link and try again.

## 2. Launch it

- **Windows:** double-click **`start.bat`** (or run `start.bat` in a terminal).
- **macOS / Linux:** run **`./start.sh`** in a terminal from this folder.

The launcher does everything for you the first time (installs dependencies,
creates your `.env`, sets up the local database) and then starts the app. On
later runs it skips the steps that are already done, so it is quick.

Prefer npm? From this folder you can run `npm install` once, then `npm run launch`.

## 3. Open the app

When you see it start, open:

> **http://localhost:3000**

Press `Ctrl+C` in the terminal to stop the server.

## AI features are optional

The app works fully without any AI key: upload decks, read slides, review
flashcards, and take timed exams all work out of the box. The AI-assisted
features (Summarize, Understand chat, and generating flashcards/exercises) need
a **free** Google Gemini key. Setting one up takes a minute and needs no credit
card: see [AI setup (optional, free)](README.md#ai-setup-optional-free) in the
README.

## Trouble?

- **"Node.js is not installed"** or nothing happens: install
  [Node.js 22+](https://nodejs.org/) and run the launcher again.
- For anything else, see the full [README](README.md), which has detailed
  install steps and a troubleshooting section.
