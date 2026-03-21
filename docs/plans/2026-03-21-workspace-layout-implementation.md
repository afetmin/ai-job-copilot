# Workspace Layout Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the workspace page into a process-oriented layout with a left editing flow, a sticky right execution rail, and a lightweight step navigator while preserving existing behavior.

**Architecture:** Keep the form as a single client component so field names, validation, submission, and routing do not change. Restructure the JSX into clearer layout sections, add a lightweight progress summary derived from current form state, and tighten the sidebar cards so execution controls remain visible without overpowering the input flow.

**Tech Stack:** Next.js App Router, React 19 client components, Tailwind CSS, Vitest, Testing Library, Lucide React

---

### Task 1: Add state needed for layout-level progress summaries

**Files:**
- Modify: `frontend/src/components/workspace/interview-pack-form.tsx`
- Test: `frontend/src/components/workspace/interview-pack-form.test.tsx`

**Step 1: Write the failing test**

Add a test that renders `InterviewPackForm`, fills only one side of the content, and asserts that a visible progress summary still shows the missing step as pending.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/components/workspace/interview-pack-form.test.tsx`
Expected: FAIL because the step navigator or summary card does not exist yet.

**Step 3: Write minimal implementation**

Add local derived booleans for:
- resume text present
- resume file present
- job description text present
- job description file present
- whether each process step is ready

Store text input values in component state so the new layout can reflect progress without changing submission behavior.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/components/workspace/interview-pack-form.test.tsx`
Expected: PASS for the new progress-summary assertion.

**Step 5: Commit**

```bash
git add frontend/src/components/workspace/interview-pack-form.tsx frontend/src/components/workspace/interview-pack-form.test.tsx
git commit -m "feat: add workspace progress summaries"
```

### Task 2: Recompose the workspace into process-based regions

**Files:**
- Modify: `frontend/src/components/workspace/interview-pack-form.tsx`

**Step 1: Reshape the header-adjacent summary area**

Replace the current three-metric intro grid with a compact process navigator that shows steps `01` through `04` and each step's readiness.

**Step 2: Rebuild the main content columns**

Move the main form into:
- left flow column with `简历材料`, `岗位上下文`, and `生成前确认`
- right sticky rail with `生成参数`, `提交任务`, `生成状态`, and a compressed boundary card

Keep the same `form`, `handleSubmit`, and `handleReset` wiring.

**Step 3: Compress supporting copy**

Shorten repetitive helper text so the layout communicates primarily through structure instead of repeated explanation.

**Step 4: Verify visually in code**

Check that no existing field labels, names, IDs, button text, or submission state checks were removed during the JSX reorganization.

**Step 5: Commit**

```bash
git add frontend/src/components/workspace/interview-pack-form.tsx
git commit -m "feat: reorganize workspace into process layout"
```

### Task 3: Tighten the sticky execution rail presentation

**Files:**
- Modify: `frontend/src/components/workspace/generation-status-card.tsx`
- Modify: `frontend/src/app/globals.css`

**Step 1: Adjust status card hierarchy**

Update `GenerationStatusCard` copy and spacing so it reads as an execution monitor instead of a large standalone billboard.

**Step 2: Add any small shared utility classes**

If the new process navigator or confirmation card needs shared utilities, add them in `globals.css` without changing the global theme direction.

**Step 3: Verify sticky behavior assumptions**

Ensure the right rail still uses `xl:sticky xl:top-6` and that card heights and spacing do not push the primary submit action below the fold unnecessarily on common desktop widths.

**Step 4: Commit**

```bash
git add frontend/src/components/workspace/generation-status-card.tsx frontend/src/app/globals.css
git commit -m "style: refine workspace execution rail hierarchy"
```

### Task 4: Expand test coverage for the new flow structure

**Files:**
- Modify: `frontend/src/components/workspace/interview-pack-form.test.tsx`

**Step 1: Add structure assertions**

Assert that the page now renders:
- the four-step process navigator
- the `生成前确认` section
- the right-rail status module

**Step 2: Re-run focused tests**

Run: `cd frontend && npm test -- src/components/workspace/interview-pack-form.test.tsx`
Expected: PASS with both the old behavior assertions and new layout assertions.

**Step 3: Commit**

```bash
git add frontend/src/components/workspace/interview-pack-form.test.tsx
git commit -m "test: cover workspace process layout"
```

### Task 5: Verify the frontend package

**Files:**
- Test: `frontend`

**Step 1: Run lint**

Run: `cd frontend && npm run lint`
Expected: PASS with no warnings.

**Step 2: Run full frontend tests**

Run: `cd frontend && npm test`
Expected: PASS for the workspace form tests and existing frontend coverage.

**Step 3: Fix regressions if found**

Adjust the affected workspace components until lint and tests pass.

**Step 4: Commit**

```bash
git add frontend/src/components/workspace/interview-pack-form.tsx frontend/src/components/workspace/generation-status-card.tsx frontend/src/components/workspace/interview-pack-form.test.tsx frontend/src/app/globals.css
git commit -m "feat: optimize workspace layout by process stage"
```
