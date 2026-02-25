# Quiz Database (Google Sheet) for Non-AI Questions

Use this if you want a fixed MCQ database (not generated live by AI).

## 1) Google Sheet columns (CSV header)

```csv
id,question,option_a,option_b,option_c,option_d,answer,explanation,drug,level,system,hint1,hint2,hint3
```

### Field rules
- `id`: unique ID (e.g. `CV-001`)
- `question`: learner-facing question text
- `option_a..option_d`: exactly 4 options
- `answer`: must match one option text exactly
- `explanation`: short rationale shown after answer
- `drug`: target drug name (used for diversity/no-repeat logic)
- `level`: one of `remembering|understanding|applying|analyzing|evaluating|all`
- `system`: e.g. `Cardiovascular system` / `Respiratory system` / `mix`
- `hint1..hint3`: progressive hints (optional)

## 2) Example row

```csv
CV-001,In unstable symptomatic bradycardia, which drug is first-line?,Atropine,Metoprolol,Adenosine,Digoxin,Atropine,Atropine increases sinus and AV nodal conduction in unstable bradycardia.,Atropine,applying,Cardiovascular system,Think antimuscarinic.,Match the indication to unstable bradycardia.,Eliminate beta-blocker and AV-slowing distractors.
```

## 3) Prompt template to generate rows with any LLM

Use this exact prompt:

```text
You are generating a pharmacology quiz bank for nursing students.
Return CSV only (no markdown, no explanations).

Output header exactly:
id,question,option_a,option_b,option_c,option_d,answer,explanation,drug,level,system,hint1,hint2,hint3

Rules:
1) Generate {N} rows.
2) Exactly 4 options per question.
3) answer must exactly equal one option text.
4) Only one best answer; distractors must be plausible but clearly less correct.
5) Keep questions concise and clinically realistic.
6) Use these allowed levels only: remembering, understanding, applying, analyzing, evaluating, all.
7) Use these systems only: Cardiovascular system, Respiratory system, Gastro-intestinal system, Central nervous system, Endocrine system, Infections, mix.
8) Do not repeat question stem or target drug.
9) Keep explanation 1-2 sentences.
10) Add progressive hints in hint1/hint2/hint3.
```

## 4) How to use in app

1. Publish your Google Sheet tab as CSV.
2. Paste the CSV URL into **Settings → Quiz bank Google Sheet CSV URL**.
3. Click **Load Quiz Database**.
4. Start quiz round: app will use sheet questions first, then AI if needed.
