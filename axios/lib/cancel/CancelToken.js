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
  // this.promise会在 发起请求的模块中(adapters).在用户执行cancel取消请求时，this.promise状态会变为resolved。 如果请求还未发出,此时需要中断请求。
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  // 将内部cancel方法被赋值给CancelToken.source.cancel
  executor(function cancel(message) {
    // 已经执行过了cancel,则直接返回
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }
    // reason字段会作为错误信息，在取消请求时被抛出
    // source.cancel(message)会生成Cancel对象，这个Cancel对象会作为取消请求时的异常被抛出，这样我们在处理错误时，能够判断error对象是否是Cancel对象来区分 是取消请求的导致的错误，还是其他错误。 
    token.reason = new Cancel(message);
    resolvePromise(token.reason);
    // 当导出的cancel函数执行后,将通过执行resolvePromise将config.CancelToken.promise状态变为resolved
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
    // 将CancelToken方法内部的cancel方法赋值给 当前cancel变量
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;