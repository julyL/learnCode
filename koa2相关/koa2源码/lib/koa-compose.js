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

  return function (context, next) {
    let index = -1;
    return dispatch(0);    // 返回一个函数,用于开始执行第一个中间件,可以通过执行next调用后续中间件

    // dispatch会始终返回一个Promise对象,koa中间件的异步处理逻辑核心就是利用Promise链
    function dispatch(i) {
      if (i <= index) {
        // 变量index由于js闭包会在中间件执行过程中一直存在,用于判断next是否多次执行
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;
      let fn = middleware[i];

      // 如果所有的中间件都已执行完,由于koa执行compose返回的函数fnMiddleware(ctx)并没有传next,所以fn为undefined,直接返回Promise.resolve()
      if (i === middleware.length) fn = next;
      if (!fn) return Promise.resolve();

      try {
        /* 
        当前中间件被包裹成了Promise对象,并且next中通过dispatch(i+1)来执行下一个中间件。需要注意一点必须return next()。因为Promise执行机制是: 当promise1对象return另一个pormise2,只有pomrise2状态变为resolved之后,promise1才会resolved。如果没有return一个Promise,那么当前中间件执行完之后这个Promise就resolved,后续中间件可能就不会执行
        为什么说koa中间件执行是洋葱模型?见如下代码
        app.use(async(ctx,next)=>{
            // 代码1
            await next();   
            // 代码2
        });
        先执行代码1,再执行await next(),await会等到next返回的Promise状态变为resolve之后再执行代码2
        执行顺序为: 【代码1 => 其他中间件 => 代码2】 洋葱是有很多层组成的, 你可以把每个中间件看作洋葱里的一层, 越早push到middleware数组的中间件就属于越外层, 整个中间件执行过程相当于 ** 【由外到内再到外】 ** 地穿透整个洋葱
        */
        return Promise.resolve(
          fn(context, function next() {
            return dispatch(i + 1);
          })
        );
      } catch (err) {
        // 中间件执行发生异常时,直接rejected停止后续中间件的执行。只需要在最后返回的Promise添加catch,就可以捕获已经执行过的中间件发生异常
        return Promise.reject(err);
      }
    }
  };
}