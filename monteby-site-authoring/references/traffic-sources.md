# Traffic-source classification

Use this reference only when the freshly fetched live contract publishes
`contract.analytics.trafficSources`. The live ordered `rules`, closed channel
lists, precedence and parameter names are authoritative for this site. Do not
copy defaults from this skill or infer a second table from vendor dashboards.

## One classifier, two consumers

Monteby uses the same server-owned rules for runtime analytics and consent-aware
attribution. A page edit must not add a second script, data-layer lookup, theme
condition or form-specific mapping. If the live contract does not express a
required source, report a configuration gap; do not hardcode it in a page.

The public result is deliberately small:

```json
{
  "version": 1,
  "channel": "ai_referral",
  "source": "chatgpt"
}
```

Only values from `outputChannels` and normalized source tokens from the live
rule table may be reported. Raw UTM values, click identifiers, query strings,
referrer paths and arbitrary hosts are evidence used by the classifier, not
analytics parameters. Never put contact data or free-form campaign labels into
an event.

## Evidence precedence

Apply the exact live `precedence` order. In the current contract that means:

1. a present campaign or click identifier is classified before the referrer;
2. an exact same-site host becomes `internal`;
3. the first matching configured referrer rule wins;
4. an unknown valid off-site host becomes the generic `referral` source;
5. absent or malformed evidence becomes `direct`.

Do not merge a stored campaign with a later campaign. A newly observed campaign
replaces the complete campaign record; navigation without a new campaign keeps
the original landing attribution and advances only the last page.

## Domain safety

When `domainMatch` is `exact-or-label-boundary-suffix`, a rule for
`chatgpt.com` may match `chatgpt.com` and `share.chatgpt.com`. It must not match
`evilchatgpt.com` or `chatgpt.com.evil.example`. Compare normalized host labels,
not string containment, link text, product names or page titles.

Never classify traffic by User Agent. A referrer from an AI product describes
the navigation source; it does not prove that an AI crawler visited the page,
that a model used or cited the page, or that the visitor was an automated agent.
Likewise, a campaign alias is owner-authored routing evidence, not identity
proof.

## Consent and reporting

The closed classification is consent-neutral, but a destination still inherits
the consent policy published by the analytics runtime. Do not bypass that gate,
replay queued events after withdrawal or retain consent-controlled attribution
after marketing consent is removed.

For a read-only report, record:

- classifier `version`, `domainMatch` and `precedence`;
- the resulting closed `channel` and `source`;
- whether the decision came from campaign, same-site, configured referrer,
  generic referral or direct evidence;
- whether the rule table was the untouched live table or an explicitly approved
  site-wide configuration change.

Do not include the raw URL, query, click identifier or referrer path in the
report. A traffic-source classification is not a conversion, indexing or AEO
verdict.

## Configuration boundary

Changing `analytics.trafficSources` affects the whole site. Do it only when the
user explicitly requests a global source-map change, through the advertised
settings surface. Preserve the line grammar and live limits; never edit the
WordPress option directly. Refetch the contract after saving and verify that
analytics and attribution expose the same normalized rule order.

Use one exact outcome:

- `traffic_source_classified` — closed source/channel derived from valid live
  evidence;
- `traffic_source_generic` — valid evidence resolved only to `campaign` or
  `referral`;
- `traffic_source_direct` — no trustworthy external evidence was present;
- `blocked_traffic_source_contract` — the live classifier contract is missing
  or internally inconsistent.
