"use strict";

/**
 * Expose compositor.
 */

module.exports = compose;

/**
 * Compose `middleware` returning
 * a fully valid middleware comprised
 * of all those which are passed.
 *
 * @param {Array} middleware
 * @return {Function}
 * @api public
 */

function compose(middleware) {
  // middleware必须为数组,并且数组中存储的所有中间件必须为函数
  if (!Array.isArray(middleware)) throw new TypeError("Middleware stack must be an array!");
  for (const fn of middleware) {
    if (typeof fn !== "function") throw new TypeError("Middleware must be composed of functions!");
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */

  /* 
    注意到composeReturnFunc的返回值始终是一个promise对象,这有2点好处
    1. 由于中间件可能存在异步处理逻辑,返回promise对象,可以在执行完所有中间件之后再进行一些额外操作
       async (ctx,next)=>{
           // 进行下一个中间件之前的预处理工作
           await next();
           // 后续所有中间件处理完成之后,再进行的额外工作
       }
    2. 中间件执行过程抛出异常时会返回一个Promise.reject(err),只需要在composeReturnFunc后添加.catch进行异常捕获即可
      koa源码: fnMiddleware(ctx).then(handleResponse).catch(onerror);  // fnMiddleware就是composeReturnFunc
      这样就可以方便的处理成功执行和出现异常的情况
  */
  // composeReturnFunc方法调用方式是fnMiddleware(ctx),可以看出这里的next没有传值为undefined
  return function composeReturnFunc(context, next) {
    // last called middleware #
    let index = -1;
    return dispatch(0);
    function dispatch(i) {
      if (i <= index)
        // 由于index是在dispatch函数外部定义的(index变量不会被释放,直到所有中间件都执行结束),中间件调用一次next方法之后index = i,如果再次调用next方法,i<=index, 这时抛出异常即可
        return Promise.reject(new Error("next() called multiple times"));
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) fn = next; // 所有的中间件都已执行完,fn赋值为next(undefined)
      if (!fn) return Promise.resolve();
      try {
        // 根据fn的调用方式得出, 所有koa中间件执行时都会接受ctx和next这2个参数,next用于调用下一个中间件
        return Promise.resolve(
          fn(context, function next() {
            return dispatch(i + 1);
          })
        );
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
}
