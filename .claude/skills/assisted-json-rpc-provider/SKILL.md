---
name: assisted-json-rpc-provider
description: Use the assisted-json-rpc-provider npm library — an ethers v5 Provider wrapper whose getLogs pulls event history over massive block ranges via the Etherscan v2 getLogs API instead of raw RPC eth_getLogs. Load when wiring up AssistedJsonRpcProvider, configuring its etherscanConfig (rangeThreshold, apiKeys, rate limits, maxResults, url with chainid), choosing between scan-API and RPC routing, or encoding topic filters — both within-position OR (ethers array topics) and the cross-position OR "matrix" encoding this library adds. For the underlying raw HTTP API and its pagination, see the etherscan-event-logs skill.
---

# assisted-json-rpc-provider

A thin wrapper around an ethers v5 `Provider` that overrides one method: `getLogs`. Everything
else (`getBalance`, `call`, `sendTransaction`, `on`, …) is forwarded verbatim to the wrapped
provider, so it drops in wherever an ethers provider is expected.

The point of the override: `eth_getLogs` on a normal RPC node rejects wide ranges ("query
returned more than 10000 results", "block range too large"), so pulling a contract's full event
history means hand-tuning block windows. This library sends those wide queries to the Etherscan
v2 `getLogs` endpoint instead — which caps on *result count* (1000/response), not block span —
and walks the results forward for you. Narrow queries still go straight to RPC.

## Setup

```js
const { AssistedJsonRpcProvider } = require('assisted-json-rpc-provider')
const { ethers } = require('ethers')

const provider = new AssistedJsonRpcProvider(
  new ethers.providers.JsonRpcProvider('https://arbitrum.meowrpc.com'),
  {
    url: 'https://api.etherscan.io/v2/api?chainid=42161', // v2: one host, chain via chainid
    apiKeys: ['YourApiKeyToken'],   // required — one throttled queue per key, round-robined
    rangeThreshold: 5000,           // span above which getLogs uses the scan API
    maxResults: 1000,               // MUST equal the API's real page cap (see gotchas)
    rateLimitCount: 1,              // requests allowed per rateLimitDuration, per key
    rateLimitDuration: 5000,        // window in ms
    // trace: true,                 // console.log the routing decision + each scan URL
  },
)

const logs = await provider.getLogs({ address, fromBlock, toBlock, topics })
```

Constructor: `new AssistedJsonRpcProvider(provider, etherscanConfig?, web3?)`.

- Omit `etherscanConfig` entirely and it's a pure pass-through — every `getLogs` goes to RPC.
  Useful for a symmetric "with/without assist" comparison (the tests do this).
- Pass a `web3` instance as the third arg to route the RPC path through
  `web3.eth.getPastLogs` instead of ethers' `provider.getLogs`. Optional.

### etherscanConfig fields

Validation and defaults live in `libs/validator.js`. Unknown properties throw.

| field | required | default (in code) | notes |
|---|---|---|---|
| `apiKeys` | **yes** | — | non-empty `string[]`; throws `missing configuration "apiKeys"` otherwise |
| `url` | in practice **yes** | none | scan endpoint incl. `?chainid=…`; **no default is applied** — without it the scan path builds a broken `undefined?…` URL |
| `rangeThreshold` | no | `4000` | span above which getLogs uses the scan API |
| `maxResults` | no | `1000` | sent as the scan request's `offset` (page size); keep it ≤ the endpoint's max offset (1000 for Etherscan v2 logs) or the endpoint caps the page and history truncates |
| `maxRetries` | no | `10` | how many times a scan request retries on *transient* failures (rate-limit-reached, HTTP 429/5xx, non-JSON body) before throwing; permanent errors (bad key, bad query) throw immediately |
| `rateLimitCount` | no | `5` | per key |
| `rateLimitDuration` | no | `1000` | ms |
| `trace` | no | — | truthy → debug logging |

## Routing: scan API vs RPC

Per call, `getLogs` picks a path from the filter (`libs/AssistedJsonRpcProvider.js`):

- **Block tags are resolved first** (only when `etherscanConfig` is set). `_resolveBlock`
  turns `fromBlock`/`toBlock` into concrete decimal numbers before any routing math:
  numbers pass through; `BigNumber`, hex strings (`0x…`) and decimal strings are parsed;
  `latest`/`pending`/`safe`/`finalized` resolve to the current block via `getBlockNumber()`;
  `earliest` and a null `fromBlock` become `0`; a null `toBlock` becomes the tip. Anything
  else **throws** (`invalid block tag …`), and `toBlock < fromBlock` throws too. This is what
  stops a non-numeric or omitted `toBlock` from silently coercing to `NaN` and slipping onto
  the capped RPC path — so an unbounded "give me everything" (`toBlock` omitted / `'latest'`)
  resolves to the tip and correctly lands on the scan API.
- **scanMode** is then on when the resolved `toBlock - fromBlock > rangeThreshold`. Otherwise
  the range is provably small and the call goes to RPC (cheaper, no key needed — safe because
  a range that short can't hit a node cap).
- **orMode** (see below) changes how topics are handled but not the scan-vs-RPC choice.

| | not orMode | orMode |
|---|---|---|
| **scan** (wide range) | `getLogsByApi` → cartesian-split topics, sweep each, merge | single paginated sweep using `_opr=or` operators |
| **RPC** (narrow) | `provider.getLogs` (or `web3.eth.getPastLogs`) | split into one filter per OR-branch, run in parallel, dedupe |

Results come back **ascending by `(blockNumber, logIndex)`**, deduped on
`transactionHash + logIndex`. On the scan path, `address` is checksummed and
`blockNumber` / `transactionIndex` / `logIndex` are coerced to numbers.

## Topics: two different "OR"s

This is the part that trips people up. The library supports two independent ways to express
alternatives, and they are encoded and detected differently.

### 1. Within-position OR — plain ethers array topics

Standard ethers semantics: an array at a topic slot means "match any of these at this
position". `isOrMode` returns **false** for this shape (the array's first element is
non-null).

```js
topics: [transferSig, [fromA, fromB]]   // topic0 = Transfer AND topic1 ∈ {fromA, fromB}
```

On the scan path the Etherscan REST API can't express within-position OR in a single request,
so the library's `translateFilter` expands the filter into the **cartesian product** of its
array positions, sweeps each resulting single-value filter separately, and merges the sorted
results. Two values in one slot → 2 sweeps; `[a,b]` × `[c,d]` across two slots → 4 sweeps.
Keep this in mind for rate-limit budgeting: wide multi-value filters fan out.

### 2. Cross-position OR — the "matrix" encoding this library adds

To ask "this address as topic1 **OR** topic2 **OR** topic3" — e.g. an account appearing as
either party of a transfer — you pass a **matrix** where each row is a topic slot and the value
for column *i* sits at position *i*. `isOrMode` detects it by a slot that is a non-empty array
whose **first element is null**.

```js
// "e6138…01df appears in topic1, topic2, OR topic3" (topic0 unconstrained)
topics: [
  [null, null, null, null],
  [null, '0x000…e61383556642af1bd7c5756b13f19a63dc8601df', null, null],
  [null, null, '0x000…e61383556642af1bd7c5756b13f19a63dc8601df', null],
  [null, null, null, '0x000…e61383556642af1bd7c5756b13f19a63dc8601df'],
]
```

Read it by **column**: column 1 puts the value at topic1, column 2 at topic2, column 3 at
topic3; those three become the OR-branches. On the scan path this is a **single** paginated
sweep that emits `topic1=…&topic2=…&topic3=…` plus the pairwise `topicX_Y_opr=or` operators —
much cheaper than the cartesian fan-out. On the RPC path it's split into one filter per branch,
run with `Promise.all`, then deduped.

Encode each topic value as a full 32-byte word (addresses left-padded to 32 bytes). See the
**etherscan-event-logs** skill for topic encoding, the `_opr` operator rules, and the raw
pagination loop this library automates.

## Pagination (handled for you)

`scanLogs` walks a wide range forward: fetch `[fromBlock, toBlock]`; if fewer than `maxResults`
rows come back the window drained and it's done; otherwise it advances `fromBlock` to the
highest block seen, drops that block's rows from the current batch (they'll be re-fetched
cleanly next round), and repeats. You never size block windows yourself.

## Gotchas

- **A single block with ≥ `maxResults` matching logs stalls the walk.** When the max block
  can't advance past `fromBlock`, `scanLogs` returns what it has so far — a silent partial
  result. Only bites very hot contracts; narrow with an extra topic or a tighter range if so.
- **Scan errors are classified, not silently retried forever.** `search()` retries only on
  *transient* failures — "rate limit reached", HTTP 429/5xx, or a non-JSON body — bounded by
  `maxRetries` (default 10), rotating API keys across attempts. A *permanent* error (invalid
  key, bad query, any other non-array `result`) throws immediately with the endpoint's message,
  so a bad key or `url` fails fast instead of hanging. The one thing to know: on a heavily
  shared free key, a long full-history sweep can hit sustained rate-limiting and exhaust
  `maxRetries` — raise it (or fix the key/rate-limit config) rather than expecting an unbounded
  wait.
- **`url` is not defaulted.** Always include it, with the right `chainid` for v2.
- **Block tags are resolved, then validated — bad input throws, it no longer falls through
  to RPC.** `fromBlock`/`toBlock` may be numbers, `BigNumber`, hex/decimal strings, or the
  usual tags (`latest`, `earliest`, …); a null `toBlock` means the tip. Anything unresolvable
  throws `invalid block tag …`, and `toBlock < fromBlock` throws. This closes the old footgun
  where a non-numeric `toBlock` coerced to `NaN`, made `scanMode` false, and silently landed a
  wide query on the RPC path (→ the node's ~10 000-block cap → truncated or empty). Resolution
  only happens when `etherscanConfig` is set; a config-less pass-through provider is untouched.
- **A resolved `latest`/null `toBlock` costs one `getBlockNumber()` round-trip** per call.
  Numeric bounds skip it. Cache the tip yourself if that overhead matters.

## Testing this library

- `npm run quick-test` — `test/quick-start/quick-start.js`, a live Arbitrum scan-mode run.
- `npm test` — mocha specs: `test/get-logs.spec.js` (web3 path + orMode parity against a plain
  provider) and `test/translate-filter.spec.js` (cartesian expansion of within-position OR).
  Both spec files hit live RPC/Etherscan, so they need network and valid keys.
