const { mergeTwoUniqSortedLogs, translateFilter } = require('../utils');
const throttledQueue = require('throttled-queue');
const fetch = require('node-fetch');
const _ = require('lodash');
const ethers = require('ethers');
const { Provider } = require('@ethersproject/providers');
// const DefaultAPIKey = 'YD1424ACBTAZBRJWEIHAPHFZMT69MZXBBI'
class AssistedJsonRpcProvider extends Provider {
    constructor(
        provider,
        etherscanConfig = {
            rangeThreshold: 5000,
            rateLimitCount: 1,
            rateLimitDuration: 5000,
            url: 'https://api.etherscan.io/api',
            maxResults: 1000,
            apiKeys: [],
        }
    ) {
        super();
        this.provider = provider;
        this.etherscanConfig = etherscanConfig;
        this.throttles = etherscanConfig.apiKeys && etherscanConfig.apiKeys.length ? etherscanConfig.apiKeys.map(() => throttledQueue(
            etherscanConfig.rateLimitCount,
            etherscanConfig.rateLimitDuration
        )) : [throttledQueue(
            etherscanConfig.rateLimitCount,
            etherscanConfig.rateLimitDuration
        )]
    }
    getBalance(...args) {
        return this.provider.getBalance(args);
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
    async getLogs(filter) {
        if (
            this.etherscanConfig &&
            filter.fromBlock != null &&
            filter.toBlock != null &&
            filter.toBlock - filter.fromBlock >
            this.etherscanConfig.rangeThreshold
        ) {
            return this.getLogsByApi(filter);
        } else {
            return this.getLogsDefault(filter);
        }
    }
    async getLogsDefault(filter) {
        return this.provider.getLogs(filter);
    }
    async getLogsByApi(filter) {
        let filters = translateFilter(filter);

        const logss = await Promise.all(filters.map(filter => this.scanLogs(filter)))
        const all = logss.reduce((result,logs)=>{
            return mergeTwoUniqSortedLogs(result, logs)
        },[])
        all.forEach(
            (log) => (log.address = ethers.utils.getAddress(log.address))
        );
        return all;
    }
    index = 0;
    getThrottle() {
        if (!this.etherscanConfig.apiKeys || this.etherscanConfig.apiKeys.length <= 0) return {
            throttle: this.throttles[0],
            apiKey: null
        }
        if (this.index > this.etherscanConfig.apiKeys.length - 1) this.index = 0
        return {
            throttle: this.throttles[this.index],
            apiKey: this.etherscanConfig.apiKeys[this.index++]
        }
    }
    async search(url) {
        try {
            while (true) {
                const { throttle, apiKey } = this.getThrottle()
                if (apiKey != null) url += `&apikey=${apiKey}`
                const res = await throttle(() =>
                    fetch(url).then((res) => res.json())
                );
                if (Array.isArray(res.result)) {
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
            let logs = await this.search(url);
            if (logs.length < this.etherscanConfig.maxResults) {
                return result.concat(logs);
            }
            fromBlock = Number(_.maxBy(logs, 'blockNumber').blockNumber) + 1;
            result = result.concat(logs);
        }
    }
    getUrlScanLog(filter) {
        let url = this.etherscanConfig.url + '?module=logs&action=getLogs';
        for (const key in filter) {
            if (Object.prototype.hasOwnProperty.call(filter, key)) {
                const value = filter[key];
                if (key == 'topics') {
                    value.forEach((topic, index) => {
                        url += topic != null ? `&topic${index}=${topic}` : '';
                    });
                } else {
                    url += value != null ? `&${key}=${value}` : '';
                }
            }
        }
        // url+=`&apikey=${DefaultAPIKey}`
        return url;
    }
}

module.exports = AssistedJsonRpcProvider;
