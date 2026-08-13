# llms.txt discovery workflow

Use this reference only when the freshly fetched live contract publishes
`contract.indexing.llmsTxt`. The live object, not a remembered file format or a
bundled snapshot, defines ownership, enabled sections, limits, eligibility and
the read-only preview resource for this site.

## Ownership comes first

Read `owner` and `servedByBuilder` before inspecting or reporting the file:

- `disabled` — Builder intentionally serves no generated `/llms.txt`;
- `external` — another component owns the address, so Builder's empty preview is
  not evidence about that component's document;
- `builder` with `servedByBuilder: true` — Builder owns the exact root file and
  its authenticated preview.

Never switch the owner, enable a section or change a case-study post-type map as
part of an ordinary page edit. Those are site-wide configuration changes and
require an explicit user request. Use the declared settings surface; never edit
the WordPress option, create a competing physical file or add a second rewrite
handler directly.

## What the document proves

The generated file is a concise Markdown directory. It can help a model find
public pages, but it is not:

- permission to crawl, train on or reproduce the site;
- a replacement for `robots.txt`, an XML sitemap or page-level `noindex`;
- proof that any model fetched, used, cited or ranked a page;
- proof that the linked page has a Markdown representation;
- an answer-engine-readiness verdict.

Report these separately. A valid `llms.txt` proves only that the generated
directory matches Monteby's bounded format and current public-content policy.

## Read-only verification

Use `resources.preview` first. Record the exact:

- `owner`, `servedByBuilder` and `fileUrl`;
- `document`, `sha256`, `bytes` and `generatedAt`;
- section IDs, display titles and item counts;
- `validation.valid`, every error and every warning.

Do not recompute a different document, reorder links, fill an empty section or
rewrite a title or description. The server-generated `document` is the preview
evidence. When `validation.valid` is false, report the exact error code and stop;
do not publish a hand-written replacement.

For public verification when Builder owns the file, fetch `fileUrl` through an
ordinary unauthenticated GET without cookies or a WordPress nonce. Require:

1. HTTP `200` and `Content-Type: text/plain; charset=utf-8`;
2. bytes identical to the authenticated preview;
3. the same SHA-256 as the preview;
4. a root H1 and no validation errors;
5. no URL that the live eligibility policy excludes.

A preview pass without the public GET is diagnostic only. A public file whose
hash differs is `blocked_llms_txt_public_mismatch`; refetch the live contract and
preview once, then stop rather than guessing which generator won.

## Section evidence

Builder selects content from explicit sources:

- `services` — pages with the effective `service` SEO role;
- `knowledge` — pages with the effective `article` or `tech_article` role;
- `authors` — published, explicitly confirmed expert profiles;
- `caseStudies` — post types explicitly mapped in site configuration;
- `contact` — an explicit `contact` page role, enriched from the central public
  company profile, or the central profile's safe site link when no contact page
  is available;
- `sitemap` — the site's XML sitemap link.

Never infer a service, contact page, author or case study from a title, slug,
screenshot or visual layout. Fixing a missing or misclassified entry means
correcting its authoritative page role, expert confirmation or content-model
configuration in a separately approved task. Do not make a one-off llms.txt
exception that disagrees with visible HTML or JSON-LD.

The eligibility policy is fail closed: only published, public, password-free,
indexable pages with ordinary visible HTML permalinks belong in the generated
sections. When `sameSiteUrlsOnly` is true, every link must also remain on the
canonical site origin. Draft, private, password-protected, off-site and
`noindex` content must never be copied into a report as a suggested replacement
link.

## Completion wording

Use one exact outcome:

- `llms_txt_disabled` — Builder is intentionally not an owner;
- `llms_txt_external_owner` — another component owns the root file;
- `llms_txt_preview_valid` — authenticated generated preview is valid, but the
  public file was not verified;
- `llms_txt_public_verified` — public bytes and SHA-256 match the valid preview;
- `blocked_llms_txt_validation` — the preview reports an error;
- `blocked_llms_txt_public_mismatch` — public bytes differ from the fresh
  preview;
- `blocked_live_contract_unavailable` — the live contract or preview could not
  be fetched.

Never rewrite these as “visible to AI”, “indexed by AI” or “AEO complete”.
