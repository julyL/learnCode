## koa2 源码解析
> koa 版本 2.4.1

### 执行流程
> 以如下示例代码进行说明

```js
const Koa = require("koa");

// 1. 执行构造函数
const app = new Koa();

// 2. 注册中间件
app.use(async (ctx, next) => {
  ctx.body = "Hello World";
});

// 3. 启动指定端口的 http 服务
app.listen(3000);
```

#### 1. 构造函数
```js
  constructor() {
    super();                                              // 继承至 Emitter

    this.proxy = false;                                   // 是否设置代理
    this.middleware = [];                                 // 存储 app.use 注册的中间件
    this.subdomainOffset = 2;     
    this.env = process.env.NODE_ENV || "development";     // 环境变量

    this.context = Object.create(context);                // this.context 对象之后会添加属性扩展成 ctx 对象
    this.request = Object.create(request);                
    this.response = Object.create(response);
    // context,request,response 对象详细说明见 context.js,request.js,response.js
  }
```

#### 2. 注册中间件

app.use(fn) 主要就是将 fn 放入中间件数组中，并通过返回 this 实现链式调用
```js
use(fn){
    // 省略转换 function *的逻辑
    this.middleware.push(fn);   
    return this;               
}
```

#### 3. 启动指定端口的 http 服务

从如下代码可以看出 app.listen 内部还是调用原生的 http 模块来启动服务
```js
 listen(...args) {
    const server = http.createServer(this.callback()); // 调用原生 http.createServer 启动服务
    return server.listen(...args);
 }
```

this.callback 执行会返回 handleRequest 作为 http.createServer 的参数
```js
  callback() {
    // 处理中间件，实现洋葱模型的核心方法
    const fn = compose(this.middleware);

    // 没有监听 error 事件则绑定默认 error 事件处理
    if (!this.listeners("error").length) this.on("error", this.onerror);

    // http.createServer(handleRequest)
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);   // 对原生的 req,res 进行扩展封装成 ctx 对象
      return this.handleRequest(ctx, fn);         // 处理请求（执行中间件并设置 res 对象）
    };

    return handleRequest;
  }
```
callback 方法是 koa 对中间件处理以及设置响应的核心逻辑</br>
我们先来看下`compose(this.middleware)`, compose 实现了 koa 中间件调用逻辑
```js
// koa-compose 模块
function compose(middleware){
    return function (context, next) {
    let index = -1;
    return dispatch(0);    // 返回一个函数，用于开始执行第一个中间件，可以通过执行 next 调用后续中间件

    // dispatch 会始终返回一个 Promise 对象，koa 中间件的异步处理逻辑核心就是利用 Promise 链
    function dispatch(i) {
      if (i <= index) {
        // 变量 index 由于 js 闭包会在中间件执行过程中一直存在，用于判断 next 是否多次执行
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;
      let fn = middleware[i];

      // 如果所有的中间件都已执行完，由于 koa 执行 compose 返回的函数 fnMiddleware(ctx) 并没有传 next, 所以 fn 为 undefined, 直接返回 Promise.resolve()
      if (i === middleware.length) fn = next;
      if (!fn) return Promise.resolve();

      try {
        /* 
        当前中间件被包裹成了 Promise 对象，并且 next 中通过 dispatch(i+1) 来执行下一个中间件。需要注意一点 next 中必须 return。因为 Promise 执行机制是：当 promise1 对象 return 另一个 pormise2, 只有 pomrise2 状态变为 resolved 之后，promise1 才会 resolved。如果没有 return 一个 Promise, 那么当前中间件执行完之后这个 Promise 就 resolved, 后续中间件可能就不会执行
        */
        return Promise.resolve(
          fn(context, function next() {
            return dispatch(i + 1);
          })
        );
      } catch (err) {
        // 中间件执行发生异常时，直接 rejected 停止后续中间件的执行。只需要在最后返回的 Promise 添加 catch, 就可以捕获已经执行过的中间件发生异常
        return Promise.reject(err);
      }
    }
}
```
compose 内部的中间件的调用逻辑见上文注释不在复述，下面说一下为什么 koa 中间件执行是**洋葱模型**?</br>
见如下代码
```js
app.use(middleware = async (ctx, next) => {
  // 代码 1
  await next();
  // 代码 2
});
```
当 middleware 中间件执行时，会先执行代码 1, 再执行 await next(),await 会等到 next 返回的 Promise 状态变为 resolve 之后再执行代码 2</br>
执行顺序为：代码 1 => 其他中间件 (middleware2 => middleware3 => ... ) => 代码 2 </br> 
洋葱是有很多层组成的，你可以把每个中间件看作洋葱里的一层，越早 push 到 middleware 数组的中间件就属于越外层，整个中间件执行过程相当于**由外到内再到外**地穿透整个洋葱</br>

讲完 compose, 接下来我们来看下内部的`handleRequest`, 调用方式 http.createServer(handleRequest)
```js
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);   // 对原生的 req,res 进行扩展封装成 ctx 对象
      return this.handleRequest(ctx, fn);         // 处理请求（执行中间件并设置 res 对象）
    };
```
createContext 方法用于创建 ctx, 在 ctx 对象扩展了一些常用对象，koa 通过拦截 get 和 set 操作来实现代理
例如：ctx 拦截了 body 的 get 和 set, 实现了对 ctx.response 的代理。对 ctx.body 的取值和赋值，实际操作的是 ctx.response.body。好处就是将 response 的逻辑分离到了 response.js 中</br>

handleRequest 方法会调用 this.handleRequest, 代码如下
```js
  handleRequest(ctx, fnMiddleware) {
    const res = ctx.res;
    res.statusCode = 404;                         // 没有调用 response.writeHead 时的默认响应状态码
    const onerror = err => ctx.onerror(err);      // 中间件的错误处理
    const handleResponse = () => respond(ctx);    // 处理请求，根据请求返回正确的状态码和内容
    onFinished(res, onerror);                     // Execute a callback when a HTTP request closes, finishes, or errors.
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);   // fnMiddleware 为 compose(this.middleware) 返回的 Promise
  }
```
`fnMiddleware(ctx).then(handleResponse).catch(onerror)`可以理解为 3 个步骤：
1. fnMiddleware(ctx): 开始执行第一个中间件（可通过 next 调用下一个中间件）
2. then(handleResponse): 一般中间件中我们会根据请求来设置 ctx.body 等字段，中间件调用结束之后，koa 根据会根据 ctx 对象来对设置 response（响应的相关内容）。例如通过 response.end(body) 或者 body.pipe(res) 来设置响应内容体
3. catch(error): 捕获中间件执行时可能发生的异常

koa 作为 web 框架，提供了一种可控制异步流程的中间件调用方式，并根据中间件处理后的结果来设置响应的相关内容

#### 结语

本文大致讲了一下 koa 的执行流程，更多细节见 [源码注释](https://github.com/julyL/Code/Node/tree/master/koa2%E7%9B%B8%E5%85%B3/koa2%E6%BA%90%E7%A0%81)