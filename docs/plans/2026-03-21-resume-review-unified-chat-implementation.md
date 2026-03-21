# Resume Review Unified Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the resume review results flow into one streaming chat pipeline that handles the first analysis message and follow-up questions while preserving the free-trial gate and BYOK fallback.

**Architecture:** Keep `workspace` responsible for document ingestion and request preparation, then move all generation work to a single chat stream used by the results page. Replace the analysis-specific frontend and backend branches with one shared message model, one proxy route, and one SSE event contract so the first auto-generated review and later user questions use the same path.

**Tech Stack:** FastAPI, Pydantic, Next.js App Router, React 19 client components, Dexie, Vitest, pytest, Testing Library

---

### Task 1: Define the unified backend chat contract

**Files:**
- Modify: `backend/src/ai_job_copilot_backend/schemas/resume_review.py`
- Modify: `backend/tests/test_resume_review_stream_api.py`

**Step 1: Write the failing tests**

Add backend API contract assertions for a new `messages` array and the unified SSE event names `start`, `context`, `citation`, `delta`, `done`, `error`.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_resume_review_stream_api.py -q`
Expected: FAIL because the backend still exposes `analysis/stream` and the old request/event shapes.

**Step 3: Write minimal implementation**

Update `resume_review.py` schemas to add:
- a chat message input model with `role` and `content`
- a unified `ResumeReviewChatRequest`
- a `ResumeReviewChatContext`
- a unified `ResumeReviewChatStreamEvent`

Keep the existing citation model if it already fits.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_resume_review_stream_api.py -q`
Expected: PASS for the new schema and route-level contract assertions.

**Step 5: Commit**

```bash
git add backend/src/ai_job_copilot_backend/schemas/resume_review.py backend/tests/test_resume_review_stream_api.py
git commit -m "feat: define unified resume review chat contract"
```

### Task 2: Replace analysis-specific backend service logic with a unified chat stream

**Files:**
- Modify: `backend/src/ai_job_copilot_backend/resume_review/service.py`
- Modify: `backend/tests/test_resume_review_generation.py`
- Modify: `backend/tests/test_resume_review_analysis_service.py`

**Step 1: Write the failing tests**

Add tests that cover:
- first-turn chat generation from a seeded initial user message
- follow-up chat generation that includes message history
- error reporting when retrieval context is missing

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_resume_review_generation.py tests/test_resume_review_analysis_service.py -q`
Expected: FAIL because the service still has separate generation and analysis branches instead of one chat stream.

**Step 3: Write minimal implementation**

Refactor `service.py` to:
- add a unified prompt builder for initial and follow-up chat turns
- derive the current query from the last user message plus `target_role`
- stream unified events with shared citation and delta handling
- keep retrieval and provider wiring centralized

Delete or inline the analysis-specific service once the new chat service replaces it cleanly.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_resume_review_generation.py tests/test_resume_review_analysis_service.py -q`
Expected: PASS for first-turn, follow-up, and error-path coverage.

**Step 5: Commit**

```bash
git add backend/src/ai_job_copilot_backend/resume_review/service.py backend/tests/test_resume_review_generation.py backend/tests/test_resume_review_analysis_service.py
git commit -m "feat: unify resume review chat generation flow"
```

### Task 3: Expose the unified backend route and retire the old analysis stream

**Files:**
- Modify: `backend/src/ai_job_copilot_backend/api/resume_review.py`
- Modify: `backend/src/ai_job_copilot_backend/main.py`
- Modify: `backend/tests/test_resume_review_stream_api.py`

**Step 1: Write the failing tests**

Add or update API tests to call `POST /api/resume-reviews/chat/stream` and assert that the route injects the new chat service and emits SSE blocks for the unified events.

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_resume_review_stream_api.py -q`
Expected: FAIL because the API router still serves `analysis/stream`.

**Step 3: Write minimal implementation**

Replace the analysis-specific dependency and route with the new chat service dependency at `/api/resume-reviews/chat/stream`. Remove dead analysis-route code if nothing else uses it.

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_resume_review_stream_api.py -q`
Expected: PASS with only the unified chat stream route under test.

**Step 5: Commit**

```bash
git add backend/src/ai_job_copilot_backend/api/resume_review.py backend/src/ai_job_copilot_backend/main.py backend/tests/test_resume_review_stream_api.py
git commit -m "feat: expose unified resume review chat stream route"
```

### Task 4: Move the frontend proxy and quota gate to the unified chat route

**Files:**
- Modify: `frontend/src/lib/backend.ts`
- Create: `frontend/src/app/api/resume-reviews/chat/route.ts`
- Create: `frontend/src/app/api/resume-reviews/chat/route.test.ts`
- Modify: `frontend/src/lib/resume-review-access.ts`
- Delete: `frontend/src/app/api/resume-reviews/analysis/route.ts`
- Delete: `frontend/src/app/api/resume-reviews/analysis/route.test.ts`

**Step 1: Write the failing tests**

Add route tests that cover:
- proxying the unified upstream chat SSE stream
- decrementing the free-trial cookie only when no local model config is provided
- returning `403` when quota is exhausted and no local model config exists

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/app/api/resume-reviews/chat/route.test.ts`
Expected: FAIL because the chat proxy route does not exist yet.

**Step 3: Write minimal implementation**

Create the new `/api/resume-reviews/chat` proxy, point `backend.ts` to `/chat/stream`, and move the cookie quota logic from the old analysis route into the new chat route.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/app/api/resume-reviews/chat/route.test.ts`
Expected: PASS for proxying, BYOK passthrough, and quota exhaustion cases.

**Step 5: Commit**

```bash
git add frontend/src/lib/backend.ts frontend/src/app/api/resume-reviews/chat/route.ts frontend/src/app/api/resume-reviews/chat/route.test.ts frontend/src/lib/resume-review-access.ts
git commit -m "feat: add unified resume review chat proxy route"
```

### Task 5: Simplify the local message model to support one continuous chat thread

**Files:**
- Modify: `frontend/src/lib/resume-review-db.ts`
- Modify: `frontend/src/lib/resume-review-db.test.ts`
- Modify: `frontend/src/components/results/chat-message.tsx`

**Step 1: Write the failing tests**

Add DB and rendering assertions that messages can be stored and displayed without `initial_analysis`-specific branching and that user/assistant roles still render correctly.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/lib/resume-review-db.test.ts src/components/results/results-workspace.test.tsx`
Expected: FAIL because the current message kind and UI labels still assume `initial_analysis`.

**Step 3: Write minimal implementation**

Update the Dexie types so message records use a smaller kind vocabulary or no special initial-analysis branch at all. Adjust `chat-message.tsx` labels and empty-state copy to match the unified chat model.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/lib/resume-review-db.test.ts src/components/results/results-workspace.test.tsx`
Expected: PASS for the updated message storage and rendering assumptions.

**Step 5: Commit**

```bash
git add frontend/src/lib/resume-review-db.ts frontend/src/lib/resume-review-db.test.ts frontend/src/components/results/chat-message.tsx frontend/src/components/results/results-workspace.test.tsx
git commit -m "refactor: normalize resume review chat message model"
```

### Task 6: Implement automatic first-turn bootstrap and streaming follow-up messages in the results page

**Files:**
- Modify: `frontend/src/components/results/results-workspace.tsx`
- Modify: `frontend/src/components/results/analysis-chat-panel.tsx`
- Modify: `frontend/src/components/results/prepared-review.tsx`
- Modify: `frontend/src/components/results/results-workspace.test.tsx`
- Modify: `frontend/src/components/results/prepared-review.test.tsx`

**Step 1: Write the failing tests**

Add UI tests that cover:
- auto-seeding the first user message when a review has no messages
- calling `/api/resume-reviews/chat` instead of `/analysis`
- enabling the send button for follow-up questions
- persisting a user message and a streaming assistant placeholder on send

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/results/results-workspace.test.tsx src/components/results/prepared-review.test.tsx`
Expected: FAIL because the results page still starts `initial_analysis` automatically and the send UI is disabled.

**Step 3: Write minimal implementation**

Refactor `ResultsWorkspace` so it:
- builds one shared SSE consumer for all assistant turns
- inserts the initial seeded user message on first load
- persists user and assistant messages around each send
- serializes the existing review history into the new chat proxy request

Update `AnalysisChatPanel` to submit real follow-up input, disable while streaming, and surface route errors.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/components/results/results-workspace.test.tsx src/components/results/prepared-review.test.tsx`
Expected: PASS for first-turn bootstrap, follow-up send flow, and streaming rendering.

**Step 5: Commit**

```bash
git add frontend/src/components/results/results-workspace.tsx frontend/src/components/results/analysis-chat-panel.tsx frontend/src/components/results/prepared-review.tsx frontend/src/components/results/results-workspace.test.tsx frontend/src/components/results/prepared-review.test.tsx
git commit -m "feat: turn resume review results into unified chat workspace"
```

### Task 7: Remove obsolete analysis-only code and verify the full stack

**Files:**
- Modify: `backend/tests/test_contracts.py`
- Modify: `backend/tests/test_resume_review_stream_api.py`
- Modify: `frontend/src/app/(protected)/results/[requestId]/page.tsx`
- Modify: `frontend/src/app/(protected)/workspace/page.tsx`
- Modify: `frontend/src/components/workspace/resume-review-form.test.tsx`

**Step 1: Remove dead references**

Delete or update any remaining imports, labels, tests, and route references that still mention `analysis` as a separate results flow.

**Step 2: Run backend verification**

Run: `cd backend && pytest`
Expected: PASS for the resume review backend suite and contract coverage.

**Step 3: Run frontend verification**

Run: `cd frontend && npm run lint`
Expected: PASS with no lint errors.

**Step 4: Run frontend tests**

Run: `cd frontend && npm test`
Expected: PASS for the updated results-page, route, and storage coverage.

**Step 5: Commit**

```bash
git add backend/tests/test_contracts.py backend/tests/test_resume_review_stream_api.py frontend/src/app/(protected)/results/[requestId]/page.tsx frontend/src/app/(protected)/workspace/page.tsx frontend/src/components/workspace/resume-review-form.test.tsx
git commit -m "feat: complete unified resume review chat flow"
```
