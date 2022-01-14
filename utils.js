const _ = require('lodash')
function convert(filter) {
    const topics =filter.topics ? new Array(filter.topics.length).fill(null).map((t,i)=>{
      return filter.topics[i] ?? t
    }) : []
    let result = {
      address: filter.address,
      ...topics,
    }
    if (filter.fromBlock != null) {
      result['fromBlock'] = filter.fromBlock
    }
    if (filter.fromBlock != null) {
      result['toBlock'] = filter.toBlock
    }
    return result
  }
  
function split(filter) {
    for (const key of Object.keys(filter)) {
      const values = _.get(filter, key)
      if (_.isArray(values)) {
        return _.flatten(
          values.map((value) => {
            const f = JSON.parse(JSON.stringify(filter))
            _.set(f, key, value)
            return split(f)
          })
        )
      }
    }
    return filter
  }
  
function explode(s) {
    let topics = { ...s }
    delete topics['address']
    delete topics['fromBlock']
    delete topics['toBlock']
    topics = Object.values(topics)
    let filter = {
      address: s['address'],
      topics: topics,
    }
    if (s['fromBlock'] != null) {
      filter['fromBlock'] = s['fromBlock']
    }
    if (s['toBlock'] != null) {
      filter['toBlock'] = s['toBlock']
    }
    
    return filter
  }
  
  module.exports = {
    convert,
    split,
    explode
}
