# AI provider options and usage costs

Research for [Research AI provider options and usage costs](https://github.com/cajkavlada/GoalCue/issues/215), accessed **13 November 2026**. This is a dated comparison of direct OpenAI, Anthropic, and Google Gemini APIs, not a provider recommendation or an exhaustive market survey. No service was purchased or called with GoalCue data. Provider/model choice and application cost policy remain for the separate integration decision.

## GoalCue requirements already agreed

Chat retrieves relevant planning records and permitted Source excerpts, explains changes, previews broad edits, and supports undo. Application code must enforce permissions, planning constraints, current-record checks, and duplicate prevention; model output alone does not authorize a change. History remains until deletion, with a temporary-chat option, while lasting preferences are stored separately. See [chat resolution](https://github.com/cajkavlada/GoalCue/issues/211#issuecomment-6856677211).

Priority inference may use permitted Task content, Project/Milestone importance, explicit instructions, and corrections. Manual Priority wins until automation is re-enabled. Importance and deadline Urgency remain distinct; skips alone do not lower Priority. See [priority resolution](https://github.com/cajkavlada/GoalCue/issues/205#issuecomment-6838411197).

External AI requires opt-in and Source exclusions. Imported work excerpts require separate Source permission; work accounts remain disconnected. Send only relevant permitted content, including identified work content in personal Sources. GoalCue deletes raw imports/messages within 24 hours after processing/retries, retains excerpts with their planning record, and stops further AI processing on disconnection. Provider-side retention is separate from those application promises. See [privacy resolution](https://github.com/cajkavlada/GoalCue/issues/202#issuecomment-6836222355).

## Terms for a first integration

A token is a small piece of text, not necessarily a word. Input includes instructions, relevant records, conversation history, tool definitions, and tool results; output includes generated text and, for applicable models, billed reasoning. A context window is the maximum material the model can work with in a request, not durable personal memory. A tool call is a request to execute an application function; structured output is a response constrained to a data format such as a Priority enum. Neither guarantees that the proposed action is correct.

These are analytical explanations. The provider token-counting and schema documentation below defines the actual accounting and supported formats.

## API capabilities and context

### OpenAI

Responses API supports application function calling and structured responses. Structured Outputs constrains supported JSON Schema, but refusals, incomplete output, errors, and business-rule validation remain application concerns. This fits both planning commands and a compact Priority-plus-reason response. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

The sampled GPT-6.1 Sol and GPT-6 Luna model pages list 1,050,000-token context and 128,000 maximum output, with function calling/structured outputs. Luna's Chat Completions function calling requires reasoning effort `none`; its Responses path supports tool use with reasoning. These are capacity limits, not required prompt sizes. [Sol model](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna).

Conversation context can be supplied explicitly or linked through response/conversation state. Chaining does not make previous input tokens free. Persistent state and local history have different deletion implications. [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state).

### Anthropic

Messages API offers JSON-schema output and strict tool inputs, usable together. Schema limitations, refusals/truncation, and a documented enum-capitalization caveat still require validation. Schema grammar artifacts can be cached for 24 hours; schemas should not contain sensitive source text. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

Claude Sonnet 5.5 and Haiku 5.5 list 1M-token context and 128K maximum output. This comparison samples both; it does not assert either is accurate enough for GoalCue without evaluation. [Models overview](https://platform.claude.com/docs/en/models/overview).

Ordinary Messages calls are stateless and send conversational history each time. Optional beta message threads retain context briefly: expiry five minutes after the last request and deletion no more than one hour after last use. This is distinct from GoalCue's durable conversation history. [Messages guide](https://platform.claude.com/docs/en/build-with-claude/working-with-messages).

### Google Gemini

Gemini supports structured JSON using a subset of JSON Schema and function calling for application actions. Valid structure still does not establish semantic correctness. Function declarations and results are part of the request/context. [Structured output](https://aistudio.google.com/docs/structured-output), [function calling](https://aistudio.google.com/docs/function-calling).

The sampled Gemini 3.8 Flash and 3.5 Flash-Lite pages list 1,048,576 input and 65,536 output token limits, with function calling, structured outputs, and caching capabilities. [Flash model](https://aistudio.google.com/docs/models/gemini-3.8-flash), [Flash-Lite model](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).

Token-count APIs and response usage report input, output, thinking, cache, and tool-related counts. Resent history consumes context and affects cost; large capacity is not a reason to send an entire mailbox. [Token accounting](https://aistudio.google.com/docs/tokens).

## Data controls: different kinds of retention

**OpenAI:** API inputs/outputs are not used for training by default. Standard abuse-monitoring logs can retain content for up to 30 days. Responses state is stored for at least 30 days by default/with `store:true`; `store:false` avoids that application state but does not itself disable abuse logs. Conversation objects persist until deletion. Zero Data Retention and other retention controls have eligibility/configuration restrictions, and stateful features and caches have separate exceptions. Do not equate opting out of storage with zero retention. [Data controls](https://developers.openai.com/api/docs/guides/your-data).

**Anthropic:** current documentation says ordinary conversation content is not retained by default and retained data is not trained on without express permission. Covered Models, currently specified Fable/Mythos models, require 30-day retention; the sampled Sonnet/Haiku are not on that list. ZDR is feature-qualified: stateful files/jobs/managed services may fall outside it, and technical artifacts can remain. Standard-policy, safety, legal, and account-specific arrangements must be verified rather than interpreting this as unconditional deletion of everything. [API retention and feature eligibility](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

**Google:** Paid Services do not use prompts/responses to improve products, but permit limited-period abuse logs and transient/cached processing across countries. The terms do not give a precise abuse-log TTL here. Importantly for a Prague user, Paid Services data-use terms also apply to unpaid quota in the EEA, Switzerland, and UK; the general free-tier training label has that regional exception. Account/jurisdiction applicability must be checked. [Gemini terms](https://aistudio.google.com/docs/terms).

Google developer-owned request/response logs are separate from abuse logs. Logging defaults on for Interactions API and Generate Content projects created on/after 26 October 2026; owners can disable it. Sharing logs with Google is a separate choice. Contributor discounts involve data sharing and are excluded from the price comparison. [Logging policy](https://aistudio.google.com/docs/logs-policy).

**GoalCue implication (analysis):** no provider's no-training statement grants permission to send imported work content. Source permission, permitted excerpts, endpoint/model settings, provider retention, local history, caches, and deletion must all be considered separately. Provider-hosted memory/files add lifecycle obligations. No claim of employer approval, zero retention, or EU-only processing is established by this research.

## Metering and budget controls

OpenAI supports spend alerts and optional organization/project hard monthly limits. Alerts alone continue traffic; enforced limits reject affected requests with 429. Enforcement is delayed, so slight overrun is possible. [Spend limits](https://developers.openai.com/api/docs/guides/spend-limits).

Anthropic permits an organization spend limit below the usage-tier ceiling and workspace limits. User-set limits reject requests once reached; rate limits separately constrain requests and tokens per minute. A rate limit is not a dollar budget. [Rate and spend limits](https://platform.claude.com/docs/en/api/rate-limits).

Gemini has billing-tier monthly caps and experimental project caps. Project enforcement can lag around ten minutes; batches/long-running agents can exceed the cap. Caps are unavailable for invoiced/offline accounts. Billing reports and AI Studio show spend. [Billing](https://aistudio.google.com/docs/billing).

Response usage can be reconciled with provider billing; provider meters, cached-token classes, and reasoning differ. For OpenAI inspect response usage, and for Claude inspect Messages usage, including cache fields. [OpenAI response reference](https://developers.openai.com/api/reference/resources/responses/methods/create), [Claude Messages reference](https://platform.claude.com/docs/en/api/messages).

**Application-control options for the later decision (analysis, not a selected policy):** reserve worst-case estimated spend before each request, reconcile actual usage, bound output/reasoning and tool-loop length, cap retries, meter chat separately from background inference, and stop new calls when remaining allowance is insufficient. Provider billing lag and concurrent requests mean a dashboard alert alone cannot promise a precise application budget. The behavior when a budget is exhausted remains undecided.

## Reproducible light-personal-use estimate

Assumed 30-day month, one user, text-only requests:

- 300 chat turns (10/day), each totaling 4,000 billed input and 600 billed output tokens across its model calls: 1.2M input + 0.18M output.
- 600 Priority inference requests (20/day), each 1,500 input + 100 output: 0.9M input + 0.06M output.
- Total: **2.1M input + 0.24M output**. Input includes scoped context/history/tool overhead. Output allowance includes any billable reasoning; if it does not fit, actual spend increases.
- Standard online, short-context rates; no cached-input savings, batch/flex discounts, credits, Contributor sharing, built-in search, files/storage, images/audio, tax, currency conversion, or application hosting. Tool loops/retries beyond the token allowances cost extra. These are assumptions, not measured GoalCue usage.

Formula: monthly USD = 2.1 × input price per million + 0.24 × output price per million.

OpenAI standard input/output USD per million and calculated totals: GPT-6 Luna $0.10/$0.50 → **$0.33**; GPT-6.1 Terra $1/$5 → **$3.30**; GPT-6.1 Sol $2/$10 → **$6.60**; GPT-6 Astra $10/$50 → **$33.00**. Long-context and regional-processing surcharges can apply; these small prompts avoid the long-context threshold. [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

Anthropic: Haiku 5.5 prompts up to 100K tokens $0.10/$0.50 → **$0.33**; Sonnet 5.5 $2/$10 → **$6.60**; Opus 5.5 $4/$20 → **$13.20**. Haiku's over-100K tier is $0.50/$2.50 and is excluded here. Cache writes have their own rates, so savings cannot be assumed from cache-hit pricing alone. [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).

Gemini: 3.5 Flash-Lite $0.30/$2.50 → **$1.23**; 3.8 Flash promotional $0.75/$3.75 through 31 December 2026 → **$2.475 (about $2.48)**, increasing to $1.50/$7.50 on 1 January 2027 → **$4.95**. Output includes thinking. Explicit cache storage may add time-based charges. [Gemini pricing](https://aistudio.google.com/docs/pricing).

Sensitivity (arithmetic, not a forecast): doubling both token totals doubles each estimate. Keeping input unchanged but tripling billed output produces $0.57 at $0.10/$0.50, $11.40 at $2/$10, and $2.43 at $0.30/$2.50. A mixed route using $2/$10 for chat and $0.10/$0.50 for inference totals $4.20 + $0.12 = **$4.32**; this illustrates routing arithmetic, not a routing recommendation.

## Uncertainties and factual trade-offs

All three sampled APIs provide the broad mechanics for chat actions and structured Priority inference. They differ in model prices, context/state lifecycles, retention conditions, cache accounting, and budget enforcement. Low price does not establish sufficient planning judgment; large context does not establish correct retrieval. No latency, quality, Czech-language behavior, or tool reliability benchmark was run. Evaluation must test manual-Priority precedence, ambiguous dates, Source exclusions, malicious source text, stale records, and undo against GoalCue's rules.

These are live official pages accessed on the stated date, not an immutable pricing contract. Model availability, credits, billing tier, regional access, retention configuration, and tax were not verified in the user's accounts. Google documents a future price change above. Recheck model IDs, terms, rates, and controls before implementation. Consumer chat subscriptions are not treated as unlimited API access; account-specific credits are outside these list-price calculations. Commercial product pricing remains out of scope. No provider, model, hosting route, budget, or retention configuration is selected.

## Research resolution

The requested factual comparison is complete. These findings supply evidence for [Choose AI integration and usage-cost controls](https://github.com/cajkavlada/GoalCue/issues/216); that decision remains open and unchanged. The cost examples are calculations under stated assumptions, not measured bills or quality rankings. No application code, purchases, commits, or pushes were performed.
