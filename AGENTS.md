<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI calls live server-side in `src/lib/ai/` (gateway.server.ts = production via Lovable AI Gateway, mock.server.ts = fallback when no key); keep mock and production logic separate so the app works without AI.
- Server functions return `{ ok, data | error }` instead of throwing so the UI can show friendly AI errors (credits, rate limits).
- Speech is captured as 16 kHz mono WAV in the browser (`src/lib/audio.ts`) and transcribed through the authenticated `/api/transcribe` server route; pause metrics are computed from the waveform client-side because the transcription API has no timestamps.
- Prompt uniqueness = AI told to avoid the user's `prompt_history` + lexical similarity filter (`similarity.ts`); every shown prompt is written to `prompt_history`.
- Protected pages live under the client-only `_authenticated` layout (ssr: false) because the session is stored in the browser.
- Live rooms use realtime on rooms/room_participants/room_messages; only the host's client generates AI participant turns to avoid duplicates.
- tsconfig drops the extra-strict flags (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature, noImplicitReturns) to keep UI code readable; `strict` stays on.
