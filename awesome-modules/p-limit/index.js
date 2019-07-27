"use strict";
const pTry = require("p-try");

const pLimit = concurrency => {
  if (concurrency < 1) {
    throw new TypeError("Expected `concurrency` to be a number from 1 and up");
  }

  const queue = []; // 异步队列 存放一个个Promise对象
  let activeCount = 0; // 记录当前正在执行的Promise的个数,用于控制并发数

  const next = () => {
    activeCount--;

    if (queue.length > 0) {
      queue.shift()();
    }
  };

  //   const pTry = (fn, ...arguments_) =>
  //     new Promise(resolve => {
  //       resolve(fn(...arguments_));
  //     });

  const run = (fn, resolve, ...args) => {
    activeCount++;

    // 这里对fn外部用Promise包裹了一层  fn不会立刻执行，而是在下一个事件循环中执行
    const result = pTry(fn, ...args);

    resolve(result);

    // 当前Promise执行完后,执行队列下一个任务
    result.then(next, next);
  };

  const enqueue = (fn, resolve, ...args) => {
    if (activeCount < concurrency) {
      run(fn, resolve, ...args);
    } else {
      queue.push(run.bind(null, fn, resolve, ...args));
    }
  };

  // 一般会将generator的返回值放入Promsie.all、Promise.race等方法来控制并发数,所以需要返回Promsie
  const generator = (fn, ...args) =>
    new Promise(resolve => enqueue(fn, resolve, ...args));

  // 暴露内部变量供外部读取,方法很优雅！ 如果直接在generator添加实例方法,则方法可以被重写。但通过Object.defineProperties方式无法被重写
  Object.defineProperties(generator, {
    activeCount: {
      get: () => activeCount
    },
    pendingCount: {
      get: () => queue.length
    }
  });

  return generator;
};

module.exports = pLimit;
module.exports.default = pLimit;
