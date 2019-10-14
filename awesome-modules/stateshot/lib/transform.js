// import { hashFunc } from './hash'
const { hashFunc } = require('./hash');

const defaultRule = {
  // StateNode => { Chunks, Children }
  toRecord: node => ({
    chunks: [{ ...node, children: undefined }], children: node.children
  }),
  // { Chunks, Children } => StateNode
  fromRecord: ({ chunks, children }) => ({ ...chunks[0], children })
}

const state2Record = (
  stateNode, chunkPool, rules = [], prevRecord = null, pickIndex = -1
) => {
  // 可以针对不同的stateNode设置不同的rule进行处理,默认会采用rules中第一个通过rule.match(statusNode)检测的rule
  const ruleIndex = rules.findIndex(({ match }) => match(stateNode))
  const rule = (rules[ruleIndex] || defaultRule)

  const { chunks, children } = rule.toRecord(stateNode)
  const recordChildren = children
  const hashes = []
  // 对status切分之后的每个chunks进行hash编码之后存储到chunkPool中
  // 相同的chunks对应相同hashKey。chunkPool是一个{},多个相同的chunk只需要存储一份
  for (let i = 0; i < chunks.length; i++) {
    const chunkStr = JSON.stringify(chunks[i])
    const hashKey = hashFunc(chunkStr)
    hashes.push(hashKey)
    chunkPool[hashKey] = chunkStr
  }
  // 当前一条的record存在children时,pickIndex用于设置只对children[pickIndex]进行state2Record处理
  if (pickIndex !== -1 && Array.isArray(prevRecord && prevRecord.children)) {
    const childrenCopy = [...prevRecord.children]
    childrenCopy[pickIndex] = state2Record(
      recordChildren[pickIndex], chunkPool, rules
    )
    return { hashes, ruleIndex, children: childrenCopy }
  } else {
    // 对当前state的children中的所有state都进行state2Record
    // chunkPool是进行存储优化的关键,相同的chunk只会存储一份
    return {
      hashes,
      ruleIndex,
      children: children &&
        children.map(node => state2Record(node, chunkPool, rules))
    }
  }
}

const record2State = (recordNode, chunkPool, rules = []) => {
  const { hashes, ruleIndex, children } = recordNode
  const chunks = hashes.map(hash => JSON.parse(chunkPool[hash]))
  const rule = (rules[ruleIndex] || defaultRule)
  return rule.fromRecord({
    chunks,
    children: children && children.map(
      node => record2State(node, chunkPool, rules)
    )
  })
}
// export { state2Record, record2State };
module.exports = { state2Record, record2State };
