### connect模块

```js
// 示例代码
var connect = require('connect');
var http = require('http');

var app = connect();

// request-handling middleware
app.use('/', (req, res, next) => {
  next();
});

// error-handling middleware
app.use('/', (err, req, res, next) => {
  next();
});

// request-handling middleware
app.use('/', (req, res, next) => {
  res.end("hello!")
});

http.createServer(app).listen(3000);
```
connect根据函数定义的传参个数将中间件划分为`request-handling middleware`和`error-handling middleware`2大类

中间件调用方式是链式的,会按照app.use时的先后顺序依次执行。程序正常执行时会跳过`error-handling middleware`只执行`request-handling middleware`,而发生错误时,则正好相反

connect内部会try catch中间件执行时发生的错误,但我们也可以调用next(err)来"声明错误"