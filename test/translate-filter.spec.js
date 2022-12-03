'use strict';
const assert = require('assert');
const { translateFilter } = require('../utils');
const Web3 = require("web3");
const AssistedJsonRpcProvider = require("../libs/AssistedJsonRpcProvider");
const { ethers } = require("ethers");

describe('Test translate filter', () => {
    it('Test with some topics', async () => {
        const filters1 = translateFilter({
            address: 'address1',
            topics: [null, ['account1', 'account2']],
        });
        assert.deepEqual(filters1, [
            {
                address: 'address1',
                topics: [null, 'account1'],
            },
            {
                address: 'address1',
                topics: [null, 'account2'],
            },
        ]);
        const filters11 = translateFilter({
            address: ['address1'],
            topics: [null, ['account1', 'account2']],
        });
        assert.deepEqual(filters11, [
            {
                address: 'address1',
                topics: [null, 'account1'],
            },
            {
                address: 'address1',
                topics: [null, 'account2'],
            },
        ]);

        const filters2 = translateFilter({
            address: 'address1',
            topics: [null, ['account1', 'account2'], ['account3']],
        });
        assert.deepEqual(filters2, [
            {
                address: 'address1',
                topics: [null, 'account1', 'account3'],
            },
            {
                address: 'address1',
                topics: [null, 'account2', 'account3'],
            },
        ]);

        const filters21 = translateFilter({
            address: 'address1',
            topics: [null, ['account1', 'account2'], 'account3'],
        });
        assert.deepEqual(filters21, [
            {
                address: 'address1',
                topics: [null, 'account1', 'account3'],
            },
            {
                address: 'address1',
                topics: [null, 'account2', 'account3'],
            },
        ]);

        const filters3 = translateFilter({
            address: 'address1',
            topics: [
                ['topic0'],
                ['account1', 'account2'],
                ['account3', 'account4'],
            ],
        });
        assert.deepEqual(filters3, [
            {
                address: 'address1',
                topics: ['topic0', 'account1', 'account3'],
            },
            {
                address: 'address1',
                topics: ['topic0', 'account1', 'account4'],
            },
            {
                address: 'address1',
                topics: ['topic0', 'account2', 'account3'],
            },
            {
                address: 'address1',
                topics: ['topic0', 'account2', 'account4'],
            },
        ]);

        const filters4 = translateFilter({
            address: 'address1',
            topics: [['topic0'], null, ['account3', 'account4']],
        });
        assert.deepEqual(filters4, [
            {
                address: 'address1',
                topics: ['topic0', null, 'account3'],
            },
            {
                address: 'address1',
                topics: ['topic0',null, 'account4'],
            }
        ]);
        const filters41 = translateFilter({
            address: 'address1',
            topics: ['topic0', null, ['account3', 'account4']],
        });
        assert.deepEqual(filters41, [
            {
                address: 'address1',
                topics: ['topic0', null, 'account3'],
            },
            {
                address: 'address1',
                topics: ['topic0',null, 'account4'],
            }
        ]);
    });
    it('Test some address', async () => {
        const filters = translateFilter({
            fromBlock: 1000,
            toBlock: 10000,
            address: [
                '0x219230d2890F50759305D88695c488669240f964',
                '0xBf481D5315F336a5aa61A5C21BB4b0eaD77ACA1F',
            ],
            topics: [null, ['account1', 'account2']],
        });
        assert.deepEqual(filters, [
            {
                fromBlock: 1000,
                toBlock: 10000,
                address: '0x219230d2890F50759305D88695c488669240f964',
                topics: [null, 'account1'],
            },
            {
                fromBlock: 1000,
                toBlock: 10000,
                address: '0xBf481D5315F336a5aa61A5C21BB4b0eaD77ACA1F',
                topics: [null, 'account1'],
            },
            {
                fromBlock: 1000,
                toBlock: 10000,
                address: '0x219230d2890F50759305D88695c488669240f964',
                topics: [null, 'account2'],
            },
            {
                fromBlock: 1000,
                toBlock: 10000,
                address: '0xBf481D5315F336a5aa61A5C21BB4b0eaD77ACA1F',
                topics: [null, 'account2'],
            },
        ]);
    });
});

describe("Test web3", () => {
    it("getlogs", async () => {
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
        let log = await as.getLogsDefault({
            fromBlock: 23552002,
            toBlock: 23552003,
            topics: [
                [
                    "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
                ],
            ],
        });
        let log1 = await as1.getLogsDefault({
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
});
