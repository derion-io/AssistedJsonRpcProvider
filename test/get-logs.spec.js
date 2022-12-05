'use strict';
const assert = require('assert');
const Web3 = require("web3");
const AssistedJsonRpcProvider = require("../libs/AssistedJsonRpcProvider");
const { ethers } = require("ethers");

describe('getLogs', () => {
    it("web3", async () => {
        const bscRpc = "https://bscrpc.com";
        const provider = new ethers.providers.JsonRpcProvider(bscRpc);
        const web3 = new Web3(bscRpc)
        let as = new AssistedJsonRpcProvider(
            provider,
            {
                rangeThreshold: 5000,
                rateLimitCount: 1,
                rateLimitDuration: 5000,
                url: "https://api.etherscan.io/api",
                maxResults: 1000,
                apiKeys: [],
            },
            web3,
        );
        let as1 = new AssistedJsonRpcProvider(provider);
        let log = await as.getLogs({
            fromBlock: 23552002,
            toBlock: 23552003,
            topics: [
                [
                    "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
                ],
            ],
        });
        let log1 = await as1.getLogs({
            fromBlock: 23552002,
            toBlock: 23552003,
            topics: [
                [
                    "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
                ],
            ],
        });
        delete log[0].id
        assert.deepEqual(log[0], log1[0]);
    });

    it("orMode", async () => {
        const bscRpc = "https://bscrpc.com";
        const provider = new ethers.providers.JsonRpcProvider(bscRpc);
        const providers = [
            new AssistedJsonRpcProvider(
                provider,
                {
                    rangeThreshold: 1000,
                    rateLimitCount: 1,
                    rateLimitDuration: 5000,
                    url: "https://api.bscscan.com/api",
                    maxResults: 1000,
                    apiKeys: [],
                },
            ),
            new AssistedJsonRpcProvider(provider),
        ]
        const filter = {
            fromBlock: 22455468,
            toBlock: 22455468 + 1001,
            topics: [
                null,
                [null, '0x000000000000000000000000C06F7cF8C9e8a8D39b0dF5A105d66127912Bc980', null],
                [null, null, '0x44444c0000000000000000000000000000000000000000000000000000000000'],
            ]
        }
        const logs = await Promise.all(providers.map((provider, i) => provider.getLogs(filter)))
        assert.equal(logs[0].length, logs[1].length)
        logs[0].forEach(log => delete log.id)
        assert.deepEqual(logs[0].map(log => log.transactionHash + log.logIndex), logs[1].map(log => log.transactionHash + log.logIndex));
    });
})
