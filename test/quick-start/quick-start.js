const { AssistedJsonRpcProvider } = require('../../libs/index');
const { ethers } = require('ethers');
const run = async () => {
    const provider = new AssistedJsonRpcProvider(
        new ethers.providers.JsonRpcProvider('https://arbitrum.meowrpc.com'),
        {
            trace: true,
            rateLimitCount: 1,
            rateLimitDuration: 5000,
            rangeThreshold: 5000,
            maxResults: 1000,
            url: 'https://api.etherscan.io/v2/api?chainid=42161',
            apiKeys:["J69FYQXEYQKAA3I13U121IGAZPQV6RRZBU"]
        }
    );
    console.log("Scan")
    const logs = await provider.getLogs({
        fromBlock: 0,
        toBlock: Number.MAX_SAFE_INTEGER,
        topics: [
                [null, null, null, null],
                [null, "0x000000000000000000000000e61383556642af1bd7c5756b13f19a63dc8601df", null, null],
                [null, null, "0x000000000000000000000000e61383556642af1bd7c5756b13f19a63dc8601df", null],
                [null, null, null, "0x000000000000000000000000e61383556642af1bd7c5756b13f19a63dc8601df"],
        ],
    });
    console.timeEnd("Scan")
    console.info('logs', logs.length);
};
run();

