# IndexNow workflow

Use this reference only when the freshly fetched live contract publishes
`contract.indexing.indexNow`. That object, not remembered routes or a provider
example, is the authority for this site.

## Facts that must stay separate

1. A successful Monteby page save proves only that WordPress persisted and
   verified the page.
2. An eligible save may add the URL to an asynchronous queue.
3. A `202` from Monteby's manual-submit resource means the queue accepted the
   URL; it is not a search-engine response.
4. Only `GET /wp-json/monteby/v1/indexnow` history can show that a delivery batch
   received `accepted`, `retrying`, or `failed` from the configured provider.
5. Provider acceptance is not an indexing or ranking guarantee.

Never report “submitted to IndexNow” from the page-save response alone. Say
“queued” when queue evidence says queued, and “provider accepted the batch” only
when fresh history says `accepted` with HTTP `200` or `202`.

## Automatic eligibility

Read `contract.indexing.indexNow.eligibility.automatic`. The normal Builder
policy requires all of the following:

- the post is published;
- its post type is public;
- it has no password;
- its effective SEO profile is not `noindex`;
- its current public permalink belongs to the current site.

Drafts, private content, password-protected content, templates, revisions,
attachments, and `noindex` pages are not indexing candidates. Do not try the
manual resource as a bypass when automatic eligibility refuses a known post.

## Manual submission

Use `contract.indexing.indexNow.resources.submit` only when the user explicitly
asks to submit one URL. Before the call:

1. prove the URL uses the same scheme, host, and port as the live site;
2. if it resolves to a current WordPress post, prove that post meets the
   automatic public/indexable rules;
3. if it no longer resolves, use it only as the former public URL of content the
   user intentionally removed;
4. do not alter query strings, invent a canonical URL, or submit a screenshot or
   preview URL;
5. do not run the worker automatically after queue acceptance.

The request body is exactly `{ "url": "https://site.example/path/" }`. Preserve
the returned state (`queued` or `duplicate`) and ID in the run report.

## Configuration and key safety

The IndexNow key is a public verification value, but changing it is still a
site-wide operational change. Never create, guess, rotate, import, or save a key
unless the user explicitly asks. Use the settings surface advertised by the
site; do not write the option directly. Verify the advertised `keyFileUrl`
through an ordinary unauthenticated GET and require an exact plain-text match.
Do not place credentials, nonces, cookies, or authorization headers in reports.

## Status and retry evidence

Use `contract.indexing.indexNow.resources.status` for read-only inspection. A
complete status report records:

- `ready`, without exposing the raw key;
- pending and due counts;
- next queue attempt and recurring cron time;
- last result, HTTP status, URL count, attempt, and retry time;
- bounded history entries relevant to the requested URL or publication.

`retrying` is an expected transient state for transport errors, `429`, and
server failures. Do not repeatedly call the manual run resource: the queue owns
backoff and retry. Use `resources.run` only when the user explicitly asks for a
manual run and the status reports a ready configuration with pending work.

## Completion wording

Use one exact outcome:

- `saved_not_queued` — page saved but indexing is disabled or ineligible;
- `queued` — Monteby accepted a new queue item;
- `duplicate` — the same URL/fingerprint was already pending;
- `provider_accepted` — fresh history records accepted HTTP `200` or `202`;
- `retrying` — the queue retained the URL for a later attempt;
- `failed` — history records a permanent refusal or exhausted retry budget;
- `blocked_live_contract_unavailable` — the live indexing contract/status could
  not be fetched.

Never equate any of these with “indexed by a search engine.”
