
#### NodeJs 异常处理

```js
// doAsync中有异步执行的代码。如果异步代码中没有对异常进行try catch(例:demo-2.js),那么doAsync外层的try catch是无法捕获到doAsync内throw的异常. 因为doAsync是在事件循环中执行的,而doAsync外层的try catch代码早在事件循环开始之前就已经执行了。

try {
    doAsync();  
}catch (err){

}

// 最佳的处理当然是直接在doAsync的内部就处理异常,这样不回中断整个程序的运行

// 保障: 通过uncaughtException事件来处理未捕获的异常(记录错误日志)
process.on("uncaughtException", err => {
    console.log("uncaughtException:",err);
    process.exit(1);
});

```