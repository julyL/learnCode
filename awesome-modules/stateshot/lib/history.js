// import { record2State, state2Record } from './transform'
const { record2State, state2Record } = require('./transform')

const noop = () => { }
class History {
  constructor(options = {
    rules: [],
    delay: 50,
    maxLength: 100,
    onChange: noop,
    useChunks: true
  }) {
    // 当前recode在$records中的位置
    this.$index = -1
    // 用于存放record的数据,每次执行push/pushSync都会产生新的record放入$records中
    // 性能优化: 当需要"删除"一个的record时,会把record在$records数组中对应位置的值设为null,而不是直接进行数组删除
    this.$records = []
    this.$chunks = {}
    // 用于设置$records数组中record的最大个数(当push过多,生成的record的个数>maxLength时，只会保留最近的record))
    this.maxLength = options.maxLength || 100

    this.rules = options.rules || []
    this.delay = options.delay || 50
    // 是否序列化存储chunk
    this.useChunks = options.useChunks === undefined ? true : options.useChunks
    this.onChange = options.onChange || noop


    this.$pending = {
      state: null, pickIndex: null, onResolves: [], timer: null
    }
    this.$debounceTime = null
  }

  // : boolean
  get hasRedo() {
    // No redo when pointing to last record.
    if (this.$index === this.$records.length - 1) return false

    // Only has redo if there're valid records after index.
    // There can be no redo even if index less than records' length,
    // when we undo multi records then push a new one.
    // records中的null值并不是有效的record。 当undo多次之后再进行push之后,此时$records中$index后面的record都会被设置为null
    let hasRecordAfterIndex = false
    for (let i = this.$index + 1; i < this.$records.length; i++) {
      if (this.$records[i] !== null) hasRecordAfterIndex = true
    }
    return hasRecordAfterIndex
  }

  // : boolean
  get hasUndo() {
    // Only has undo if we have records before index.
    // 1. 当$records的长度 < maxLength时, $index > 0 就表示可以undo
    // 2. 当$records长度 > maxLength时，只会保留最近的maxLength次的record, [0,$records.length - maxLength)之间的记录将被清除, 有效的第一条记录的位置为$records.length - maxLength
    const lowerBound = Math.max(this.$records.length - this.maxLength, 0)
    return this.$index > lowerBound
  }

  // : number
  get length() {
    return Math.min(this.$records.length, this.maxLength)
  }

  // void => State
  get() {
    const currentRecord = this.$records[this.$index]
    let resultState
    if (!currentRecord) {
      resultState = null
    } else if (!this.useChunks) {
      resultState = currentRecord
    } else {
      resultState = record2State(currentRecord, this.$chunks, this.rules)
    }
    this.onChange(resultState)
    return resultState
  }

  // (State, number?) => History
  pushSync(state, pickIndex = -1) {
    const latestRecord = this.$records[this.$index] || null
    // useChunks为ture, 会对status进行编码之后存储
    // useChunks为false,则存储status时不进行处理
    const record = this.useChunks
      ? state2Record(state, this.$chunks, this.rules, latestRecord, pickIndex)
      : state
    this.$index++
    this.$records[this.$index] = record
    // Clear redo records.
    // 执行push操作会将当前位置之后的所有record从$records中清除
    // 例如: [a,b,c,d]  (执行3次undo)=>  [a]  (push e)=>  [a,e] 原先的b,c,d状态被清除
    for (let i = this.$index + 1; i < this.$records.length; i++) {
      this.$records[i] = null
    }
    // Clear first valid record if max length reached.
    // 只保留最近的长度为maxLength的$records
    if (this.$index >= this.maxLength) {
      this.$records[this.$index - this.maxLength] = null
    }

    // Clear pending state.
    if (this.$pending.timer) {
      clearTimeout(this.$pending.timer)
      this.$pending.state = null
      this.$pending.pickIndex = null
      this.$pending.timer = null
      this.$debounceTime = null
      this.$pending.onResolves.forEach(resolve => resolve(this))
      this.$pending.onResolves = []
    }

    this.onChange(state)
    return this
  }

  // (State, number?) => Promise<History>
  push(state, pickIndex = -1) {
    const currentTime = +new Date()
    const setupPending = () => {
      this.$pending.state = state
      this.$pending.pickIndex = pickIndex
      this.$debounceTime = currentTime
      const promise = new Promise((resolve, reject) => {
        this.$pending.onResolves.push(resolve)
        this.$pending.timer = setTimeout(() => {
          this.pushSync(this.$pending.state, this.$pending.pickIndex)
        }, this.delay)
      })
      return promise
    }
    // First time called.
    if (this.$pending.timer === null) {
      return setupPending()
    } else if (currentTime - this.$debounceTime < this.delay) {
      // 如果两次执行push的时间间隔currentTime - this.$debounceTime 小于 this.delay, 则进行防抖处理
      // Has been called without resolved.
      clearTimeout(this.$pending.timer)
      this.$pending.timer = null
      return setupPending()
    } else return Promise.reject(new Error('Invalid push ops'))
  }

  // void => History
  undo() {
    if (this.hasUndo) this.$index--
    return this
  }

  // void => History
  redo() {
    if (this.hasRedo) this.$index++
    return this
  }

  // void => History
  reset() {
    this.$index = -1
    this.$records.forEach(tree => { tree = null })
    Object.keys(this.$chunks).forEach(key => { this.$chunks[key] = null })
    this.$records = []
    this.$chunks = {}
    clearTimeout(this.$pending.timer)
    this.$pending = {
      state: null, pickIndex: null, onResolves: [], timer: null
    }
    this.$debounceTime = null
    return this
  }
}
// export History;
module.exports = {
  History
};