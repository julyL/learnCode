'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  // executor函数用于导出内部cancel函数暴露给外部使用
  executor(function cancel(message) {
    // 已经执行过了cancel,则直接返回
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason); // 当导出的cancel函数执行后,将通过执行resolvePromise将config.CancelToken.promise状态变为resolved
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  // reason存在说明已经执行了cancel函数,表明这时请求已经被取消,相当于请求失败了直接抛出异常
  // 【取消请求抛出的异常】和【其他异常】可以通过axios.isCancel(error)来进行区分处理
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c; // 导出内部cancel函数
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;