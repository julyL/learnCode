/**
 * Machine.js
 */

const nameup = require('./nameup')

function Machine(options) {
  this._options = options
  this._state = options.initial // 状态机初始状态
  this._states = this._options.states // 状态机所有状态的映射关系
}

Machine.prototype = {
  fire: function (event, ...args) {
    let current_state = this._state
    let states = this._states
    let to_state = ((states[current_state] || {}).on || {})[event]
    // 如果查询create方法定义的状态机 当前状态无法执行指定的event事件,则直接抛异常
    if (!to_state || typeof to_state !== 'string') {
      throw new Error(`bad event [${event}] on state [${current_state}]`)
    }
    // 状态机中未定义此状态，也抛异常
    if (!states[to_state]) {
      throw new Error(`can't transfer to state [${to_state}]`)
    }

    // 事件名驼峰处理 eg:  on_enter_on =>  onEnterOn
    const onFunc = (name, ...args2) => {
      let fn = this[nameup(name)]
      if (typeof fn === 'function') {
        return fn.call(this, ...args2)
      }
    }

    // 当状态从beforeState变化到state时会依次触发3个事件
    // 离开上一个状态onLeaveBeforeState -> 进入当前状态onEnterState -> 当前状态改变onState
    // 使用Promise链将3个事件的执行串联起来的优势在于可以处理事件中的异步情况,如事件可以返回一个Promise对象来使得后续的事件根据该Promsie的状态决定是否执行
    return Promise.resolve()
      .then(() => onFunc('on_leave_' + current_state))
      .then(() => onFunc('on_enter_' + to_state))
      .then(() => {
        this._last_state = this._state
        this._state = to_state
      })
      .then(() => onFunc('on_' + to_state, ...args))
  },

  // 判断状态机中当前状态的是否定义了event事件
  canFire: function (event) {
    return !!((this._states[this._state] || {}).on || {})[event]
  },

  getState: function () {
    return this._state
  },

  getLastState: function () {
    return this._last_state
  }
}

module.exports = Machine