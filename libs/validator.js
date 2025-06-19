function standardizeStartConfiguration(config) {
    if (!config) {
        throw new Error('undefined configuration')
    }

    const knownProps = [
        'trace',
        'rangeThreshold',
        'rateLimitCount',
        'rateLimitDuration',
        'url',
        'maxResults',
        'apiKeys'
    ]

    _validateRangeThreshold(config.rangeThreshold)
    _validateRateLimitCount(config.rateLimitCount)
    _validateRateLimitDuration(config.rateLimitDuration)
    _validateMaxResult(config.maxResults)
    _validateApiKeys(config.apiKeys)

    const unknownProp = Object.keys(config).find(prop => !knownProps.includes(prop))
    if (unknownProp) {
        throw new Error('configuration has unknown property: ' + unknownProp)
    }
    const defaultConfig = {
        rangeThreshold: 4000,
        maxResults: 1000,
        rateLimitCount: 5,
        rateLimitDuration: 1000,
    }
    return Object.assign(defaultConfig, config)
}

function _validateRangeThreshold(value) {
    if (value == null) {
        return
    }

    if (!Number.isInteger(value) || value < 0) {
        throw new Error('invalid configuration "rangeThreshold"')
    }
}

function _validateRateLimitCount(value){
    if (value == null) {
        return
    }

    if (!Number.isInteger(value) || value < 1) {
        throw new Error('invalid configuration "rateLimitCount"')
    }
}

function _validateRateLimitDuration(value){
    if (value == null) {
        return
    }

    if (!Number.isInteger(value) || value < 0) {
        throw new Error('invalid configuration "rateLimitDuration"')
    }
}

function _validateMaxResult(value){
    if (value == null) {
        return
    }

    if (!Number.isInteger(value) || value < 1) {
        throw new Error('invalid configuration "maxResults"')
    }
}

function _validateApiKeys(value){
    if (!value?.length) {
        throw new Error('missing configuration "apiKeys"')
    }
}

module.exports = {
    standardizeStartConfiguration
}