# GitHub Actions runner investigation

Observed historical workflow run: [44871244970](https://github.com/Csp-Ai/Bender/actions/runs/44871244970).

The GitHub API reports `completed / failure`, with **one job, zero executed steps and no assigned runner name**. Similar prior runs failed shortly after creation. That makes this an **unprovisioned-job failure**, not evidence of failing Node or Python assertions.

### Verified facts

- `.github/workflows/tests.yml` defines a valid-looking Ubuntu-hosted job with checkout, setup Python 3.12 / Node 20, dependencies and both test suites.
- The latest branch can run those suites in an isolated Vercel sandbox, and Vercel's test-gated preview separately exercises the Node suite.
- The connected GitHub API does not expose repo Actions enablement, billing quota, runner assignment policies, or organization administrative controls needed to identify the precise root cause. Do not speculate or claim account restrictions caused it.
- Repeatedly changing code alone cannot prove runner availability.

### Owner / admin actions

Open GitHub → **Csp-Ai/Bender → Actions → failed Bender tests run**. Check any job-level or account-level notice explaining why the runner was not assigned. Then inspect repository **Settings → Actions → General**, the owner's runner eligibility and any billing or minutes messages, and applicable organization policy. If runner service is down, check GitHub Status.

If no administrative cause is visible, obtain the run ID and job ID from the UI for GitHub Support. After remediation, rerun the entire workflow on the **exact PR head SHA** and confirm all steps executed and returned success.

Until then, **GitHub Actions is a release blocker**. Vercel build or sandbox test success is valuable independent evidence, but it is not a substitute for a green GitHub check.
