const { mergeTwoUniqSortedLogs, translateFilter, splitOrFilter, isOrMode } = require('../utils');
const fetch = require('node-fetch');
const _ = require('lodash');
const ethers = require('ethers');
const AsyncTaskThrottle = require('async-task-throttle-on-response').default
const { Provider } = require('@ethersproject/providers');
const { standardizeStartConfiguration } = require('./validator');

/**
 * etherscanConfig = {
 *  rangeThreshold: 5000,
 *  rateLimitCount: 1,
 *  rateLimitDuration: 5000,
 *  url: 'https://api.etherscan.io/api',
 *  maxResults: 1000,
 *  apiKeys: ['YourApiKeyToken'],
 * }
 */
class AssistedJsonRpcProvider extends Provider {
    constructor(
        provider,
        etherscanConfig,
        web3,
    ) {
        super();
        this.provider = provider;
        if (etherscanConfig != null) {
            let validConfig = standardizeStartConfiguration(etherscanConfig)
            this.etherscanConfig = validConfig;
            this.queues = this.etherscanConfig.apiKeys.map((apiKey) => {
                const queue = AsyncTaskThrottle.create(fetch.bind(typeof window !== 'undefined' ? window : this), validConfig.rateLimitCount, validConfig.rateLimitDuration)
                queue.apiKey = apiKey
                return queue
            })
        }
        if (web3) {
            this.web3 = web3
        }
    }
    // Queries
    getBalance(...args) {
        return this.provider.getBalance(...args);
    }
    getBlock(...args) {
        return this.provider.getBlock(...args);
    }
    getBlockNumber(...args) {
        return this.provider.getBlockNumber(...args);
    }
    getBlockWithTransactions(...args) {
        return this.provider.getBlockWithTransactions(...args);
    }
    getCode(...args) {
        return this.provider.getCode(...args);
    }
    getFeeData(...args) {
        return this.provider.getFeeData(...args);
    }
    getGasPrice(...args) {
        return this.provider.getGasPrice(...args);
    }
    getNetwork(...args) {
        return this.provider.getNetwork(...args);
    }
    getStorageAt(...args) {
        return this.provider.getStorageAt(...args);
    }
    getTransaction(...args) {
        return this.provider.getTransaction(...args);
    }
    getTransactionReceipt(...args) {
        return this.provider.getTransactionReceipt(...args);
    }
    getTransactionCount(...args) {
        return this.provider.getTransactionCount(...args);
    }
    // Execution
    sendTransaction(...args) {
        return this.provider.sendTransaction(...args);
    }
    call(...args) {
        return this.provider.call(...args);
    }
    estimateGas() {
        return this.provider.estimateGas(...args);
    }
    // ENS
    resolveName(...args) {
        return this.provider.resolveName(...args)
    };
    lookupAddress(...args) {
        return this.provider.lookupAddress(...args)
    };
    // Event Emitter (ish)
    on(...args) {
        return this.provider.on(...args)
    };
    once(...args) {
        return this.provider.once(...args)
    }
    emit(...args) {
        return this.provider.emit(...args)
    }
    listenerCount(...args) {
        return this.provider.listenerCount(...args)
    }
    listeners(...args) {
        return this.provider.listeners(...args)
    };
    off(...args) {
        return this.provider.off(...args)
    };
    removeAllListeners(...args) {
        return this.provider.removeAllListeners(...args)
    };

    waitForTransaction(...args) {
        return this.provider.waitForTransaction(...args)
    }
    // Override
    async getLogs(filter) {
        const scanMode = this.etherscanConfig &&
            filter.fromBlock != null &&
            filter.toBlock != null &&
            filter.toBlock - filter.fromBlock >
            this.etherscanConfig.rangeThreshold
        const orMode = isOrMode(filter.topics)
        if (this.etherscanConfig?.trace) {
            console.log('AssistedJsonRpcProvider.getLogs', { scanMode, orMode })
        }
        if (!orMode) {
            if (scanMode) {
                return this.getLogsByApi(filter);
            }
            return this.getLogsByRpc(filter)
        }
        if (scanMode) {
            return this.scanLogs(filter)
        }
        const filters = splitOrFilter(filter)
        const logss = await Promise.all(
            filters.map(filter => this.getLogsByRpc(filter)),
        )
        const logs = _.uniqBy(logss.flat(), log => log.transactionHash + log.logIndex)
        return logs
    }
    getLogsByRpc(filter) {
        if (this.etherscanConfig?.trace) {
            console.log('AssistedJsonRpcProvider.getLogsByRpc', filter)
        }
        if (this.web3) {
            return this.web3.eth.getPastLogs(filter);
        }
        return this.provider.getLogs(filter);
    }
    async getLogsByApi(filter) {
        let filters = translateFilter(filter);

        const logss = await Promise.all(filters.map(filter => this.scanLogs(filter)))

        const all = logss.reduce((result, logs) => {
            return mergeTwoUniqSortedLogs(result, logs)
        }, [])

        return all;
    }
    getQueue() {
        this.index = (this.index < this.queues.length - 1) ? (this.index + 1) : 0
        return this.queues[this.index]
    }
    async search(url) {
        try {
            while (true) {
                const queue = this.getQueue()
                const urlApiKey = url + `&apikey=${queue.apiKey}`

                const res = await queue(urlApiKey).then((res) => res.json());

                if (Array.isArray(res.result)) {
                    // Convert hex string to number
                    res.result.forEach((log) => {
                        log.address = ethers.utils.getAddress(log.address)
                        log.blockNumber = Number(log.blockNumber) || 0
                        log.transactionIndex = Number(log.transactionIndex) || 0
                        log.logIndex = Number(log.logIndex) || 0
                    })
                    return res.result;
                }
            }
        } catch (error) {
            throw error;
        }
    }
    async scanLogs(filter) {
        let result = [];
        let fromBlock = filter.fromBlock;
        while (true) {
            const url = this.getUrlScanLog({
                ...filter,
                fromBlock,
            });

            if (this.etherscanConfig?.trace) {
                console.log('AssistedJsonRpcProvider.scanLogs', url)
            }
            let logs = await this.search(url);

            if (logs.length < this.etherscanConfig.maxResults) {
                return result.concat(logs);
            }
            let maxLog = _.maxBy(logs, 'blockNumber')

            if (maxLog == null) return result // if Logs = []

            const maxBlock = Number(maxLog.blockNumber);
            if (maxBlock <= fromBlock) {
                return result; // cant advance blocks
            }

            fromBlock = maxBlock;

            // Truncate forward 1 block
            logs = logs.filter((log) => Number(log.blockNumber) < fromBlock)

            result = result.concat(logs);
        }
    }
    getUrlScanLog(filter) {
        let url = this.etherscanConfig.url;
        url += url.includes('?') ? '&' : '?';
        url += 'module=logs&action=getLogs';
        for (const key in filter) {
            if (Object.prototype.hasOwnProperty.call(filter, key)) {
                const value = filter[key];
                if (key == 'topics') {
                    url += getTopicsQuery(value)
                } else {
                    url += value != null ? `&${key}=${value}` : '';
                }
            }
        }
        // url+=`&apikey=${DefaultAPIKey}`
        return url;
    }
}

function getTopicsQuery(topics) {
    const orMode = isOrMode(topics)
    let query = ''
    if (!orMode) {
        topics.forEach((topic, index) => {
            query += topic != null ? `&topic${index}=${topic}` : ''
        })
        return query
    }
    const ts = []
    for (let i = 0; i < 4; ++i) {
        ts.push(topics[i]?.[i])
    }
    for (
        let iLast = undefined, i = _.findIndex(ts, topic => topic != null);
        i >= 0;
        iLast = i, i = _.findIndex(ts, topic => topic != null, iLast+1)
    ) {
        if (ts[i] == null) continue
        query += `&topic${i}=${ts[i]}`
        if (iLast !== undefined) {
            query += `&topic${iLast}_${i}_opr=or`
        }
    }
    return query
}

module.exports = AssistedJsonRpcProvider;
