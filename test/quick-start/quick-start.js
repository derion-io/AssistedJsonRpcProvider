const { AssistedJsonRpcProvider } = require('../../libs/index');
const { ethers } = require('ethers');
const run = async () => {
    const provider = new AssistedJsonRpcProvider(
        new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org'),
        {
            rateLimitCount: 1,
            rateLimitDuration: 5000,
            rangeThreshold: 5000,
            maxResults: 1000,
            url: 'https://api.bscscan.com/api',
            // apiKeys:[]
        }
    );
    console.time("Scan")
    const logs = await provider.getLogs({
        fromBlock: 0,
        toBlock: 14328200,
        topics: [
            null,
            [
                '0x000000000000000000000000efebf78ae76268b27bcac3e225bec2539212215d',
                '0x000000000000000000000000686D9058bdD043167FAd1CbCe5F0e04007D9A76B',
                '0x000000000000000000000000219230d2890F50759305D88695c488669240f964'
            ],
        ],
    });
    console.timeEnd("Scan")
    console.info('logs', logs.length);
};
run();

