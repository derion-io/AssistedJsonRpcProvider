# APIs

## new AssistedJsonRpcProvider(provider, config?, web3?)

```js
const { ethers } = require('ethers')
const { AssistedJsonRpcProvider } = require('assisted-json-rpc-provider')

// provider  {ethers.Provider}  the underlying provider. Everything except getLogs
//                              is forwarded to it untouched. Drop the config and
//                              the wrapper is a plain pass-through (getLogs -> RPC).
// web3      {Web3}             optional. When passed, the RPC path for getLogs uses
//                              web3.eth.getPastLogs instead of provider.getLogs.
//
// config fields (validated in libs/validator.js):
//  * url             {string}    required for scan mode. Scan endpoint including the
//                                chain selector on v2, e.g.
//                                "https://api.etherscan.io/v2/api?chainid=42161".
//                                There is no default — omit it and scan requests break.
//  * apiKeys         {string[]}  required. One throttled request queue per key, used
//                                round-robin; more keys, more rate-limit headroom.
//  * rangeThreshold  {number}    default 4000. getLogs with (toBlock - fromBlock)
//                                wider than this goes to the scan API; anything
//                                narrower goes straight to RPC.
//  * maxResults      {number}    default 1000. Sent as the scan request's offset (the
//                                page size). Keep it at or below the endpoint's max
//                                offset (1000 on Etherscan v2 logs), or pages get
//                                capped and history is truncated.
//  * maxRetries      {number}    default 10. Transient scan failures (rate limit,
//                                HTTP 429/5xx, non-JSON body) retry up to this many
//                                times; permanent errors (bad key, bad query) throw.
//  * rateLimitCount  {number}    default 5. Max requests per window, per key.
//  * rateLimitDuration {number}  default 1000. Window length in ms. So the default is
//                                5 requests / second / key.
//  * trace           {boolean}   default off. Logs the routing decision and each scan URL.
//
// Returns an ethers.Provider whose getLogs resolves arbitrarily wide block ranges.

const provider = new AssistedJsonRpcProvider(
    new ethers.providers.JsonRpcProvider('https://arbitrum.meowrpc.com'),
    {
        url: 'https://api.etherscan.io/v2/api?chainid=42161',
        apiKeys: ['YourApiKeyToken'],
        rangeThreshold: 1000,
        maxResults: 1000,
        rateLimitCount: 1,
        rateLimitDuration: 5000,
    },
)
```
