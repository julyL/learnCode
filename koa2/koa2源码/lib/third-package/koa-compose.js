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
  if (!Array.isArray(middleware))
    throw new TypeError("Middleware stack must be an array!");
  for (const fn of middleware) {
    if (typeof fn !== "function")
      throw new TypeError("Middleware must be composed of functions!");
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */

  return function(context, next) {
    // compose返回的函数在Koa源码application.js中通过fnMiddleware(ctx)方式进行调用, 所以next恒定为undefined
    // last called middleware #
    let index = -1;   
    return dispatch(0);
    function dispatch(i) {
      if (i <= index)   // 由于形成了闭包,index变量在所有的中间件未执行完是不会被释放的
        // 中间件执行前 i>index, 执行后i===index
        return Promise.reject(new Error("next() called multiple times"));
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) fn = next; // 所有的中间件都已执行完,fn赋值为next(也就是undefined)
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(context, function next() {
          /*
               app.use((ctx,next)=>{  
                    // 添加中间件之前的代码
                    next();   // next方法会调用其他中间件
                    // 添加中间件之后的代码
              })      
          */
            return dispatch(i + 1); // 在next方法内部只是简单地执行下一个中间件, 所有的中间件就会按照app.use注册的顺序进行执行,这样实现了在当前逻辑中就穿插了一个中间件,著名的洋葱模型由此形成。 由于中间件可能存在异步操作的所以next方法返回的是Promise对象,方便进行异步流程控制 eg: next().then
          })
        );
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
}
