const { convert, split, explode } = require('../utils');
const throttledQueue = require('throttled-queue');
const fetch = require('node-fetch');
const _ = require('lodash');
const ethers = require('ethers');
const { JsonRpcProvider } = require('@ethersproject/providers');
class AssistedJsonRpcProvider extends  JsonRpcProvider{
    constructor(
        url,
        network,
        etherscanConfig = {
            rangeThreshold: 5000,
            rateLimit: 5,
            baseUrl: 'https://api.bscscan.com/api',
            endpointReturnsMaximum: 1000,
        }
    ) {
        super(url, network);
        this.defautlProvider = new JsonRpcProvider(url, network);
        this.etherscanConfig = etherscanConfig;
        this.throttle = throttledQueue(etherscanConfig.rateLimit, 1000);
    }
    async getLogs(filter) {
        if (filter.toBlock == null) {
            this.head = await this.defautlProvider.getBlockNumber();
        }
        if (
            this.etherscanConfig &&
            filter.fromBlock != null &&
            (filter.toBlock ?? this.head) - filter.fromBlock >
                this.etherscanConfig.rangeThreshold
        ) {
            return this.getLogsByApi(filter);
        } else {
            return this.getLogsDefault(filter);
        }
    }
    async getLogsDefault(filter) {
        return this.defautlProvider.getLogs(filter);
    }
    async getLogsByApi(filter) {
        let filterSplit = split(convert(filter));
        if (Array.isArray(filterSplit)) {
            filterSplit = filterSplit.map((e) => explode(e));
        } else {
            filterSplit = [explode(filterSplit)];
        }
        let logss = [];
        for (let index = 0; index < filterSplit.length; index++) {
            const f = filterSplit[index];
            const logs = await this.scanLogs(f);
            console.info(
                `Get log from ${filterSplit.fromBlock} to ${filterSplit.toBlock} have ${logs.length}`
            );
            logs.forEach(
                (log) => (log.address = ethers.utils.getAddress(log.address))
            );
            logss.push(logs);
        }
        const logsOrdered = _.orderBy(_.flatten(logss), 'blockNumber');
        logsOrdered.forEach(
            (log) => (log.address = ethers.utils.getAddress(log.address))
        );
        return logsOrdered;
    }
    async search(url) {
        try {
            while (true) {
                const res = await this.throttle(async () => {
                    const res = await fetch(url, {
                        method: 'GET',
                    }).then((res) => res.json());
                    return Promise.resolve(res);
                });

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
            logs = logs.map((log) => ({
                ...log,
                blockNumber: parseInt(log.blockNumber, 16),
            }));
            if (logs.length < this.etherscanConfig.endpointReturnsMaximum) {
                return result.concat(logs);
            }
            fromBlock = _.maxBy(logs, 'blockNumber').blockNumber + 1;
            result = result.concat(logs);
        }
    }
    getUrlScanLog(filter) {
        let url = this.etherscanConfig.baseUrl + '?module=logs&action=getLogs';
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
        return url;
    }
}

module.exports = AssistedJsonRpcProvider;
