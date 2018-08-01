## koa2源码解析
> koa版本2.4.1

### 执行流程
> 以如下示例代码进行说明

```js
const Koa = require("koa");

// 1.执行构造函数
const app = new Koa();

// 2.注册中间件
app.use(async (ctx, next) => {
  ctx.body = "Hello World";
});

// 3.启动指定端口的http服务
app.listen(3000);
```

#### 1.构造函数
```js
  constructor() {
    super();                                              // 继承至Emitter

    this.proxy = false;                                   // 是否设置代理
    this.middleware = [];                                 // 存储app.use注册的中间件
    this.subdomainOffset = 2;     
    this.env = process.env.NODE_ENV || "development";     // 环境变量

    this.context = Object.create(context);                // this.context对象之后会添加属性扩展成ctx对象
    this.request = Object.create(request);                
    this.response = Object.create(response);
    // context,request,response对象详细说明见context.js,request.js,response.js
  }
```

#### 2.注册中间件

app.use(fn)主要就是将fn放入中间件数组中,并通过返回this实现链式调用
```js
use(fn){
    // 省略转换function*的逻辑
    this.middleware.push(fn);   
    return this;               
}
```


#### 3.启动指定端口的http服务

从如下代码可以看出app.listen内部还是调用原生的http模块来启动服务
```js
 listen(...args) {
    const server = http.createServer(this.callback()); // 调用原生http.createServer启动服务
    return server.listen(...args);
 }
```

this.callback执行会返回handleRequest作为http.createServer的参数
```js
  callback() {
    // 处理中间件, 实现洋葱模型的核心方法
    const fn = compose(this.middleware);

    // 没有监听error事件则绑定默认error事件处理
    if (!this.listeners("error").length) this.on("error", this.onerror);

    // http.createServer(handleRequest)
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);   // 对原生的req,res进行扩展封装成ctx对象
      return this.handleRequest(ctx, fn);         // 处理请求(执行中间件并设置res对象)
    };

    return handleRequest;
  }
```
callback方法是koa对中间件处理以及设置响应的核心逻辑</br>
我们先来看下`compose(this.middleware)`, compose实现了koa中间件调用逻辑
```js
// koa-compose模块
function compose(middleware){
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
        当前中间件被包裹成了Promise对象,并且next中通过dispatch(i+1)来执行下一个中间件。需要注意一点next中必须return。因为Promise执行机制是: 当promise1对象return另一个pormise2,只有pomrise2状态变为resolved之后,promise1才会resolved。如果没有return一个Promise,那么当前中间件执行完之后这个Promise就resolved,后续中间件可能就不会执行
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
}
```
compose内部的中间件的调用逻辑见上文注释不在复述,下面说一下为什么koa中间件执行是**洋葱模型**?</br>
见如下代码
```js
app.use(middleware = async (ctx, next) => {
  // 代码1
  await next();
  // 代码2
});
```
当middleware中间件执行时,会先执行代码1,再执行await next(),await会等到next返回的Promise状态变为resolve之后再执行代码2</br>
执行顺序为: 代码1 => 其他中间件(middleware2 => middleware3 => ... ) => 代码2 </br> 
洋葱是有很多层组成的,你可以把每个中间件看作洋葱里的一层,越早push到middleware数组的中间件就属于越外层,整个中间件执行过程相当于**由外到内再到外**地穿透整个洋葱</br>

讲完compose,接下来我们来看下内部的`handleRequest`,调用方式http.createServer(handleRequest)
```js
    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);   // 对原生的req,res进行扩展封装成ctx对象
      return this.handleRequest(ctx, fn);         // 处理请求(执行中间件并设置res对象)
    };
```
createContext方法用于创建ctx, 在ctx对象扩展了一些常用对象,koa通过拦截get和set操作来实现代理
例如:ctx拦截了body的get和set,实现了对ctx.response的代理。对ctx.body的取值和赋值,实际操作的是ctx.response.body。好处就是将response的逻辑分离到了response.js中</br>

handleRequest方法会调用this.handleRequest,代码如下
```js
  handleRequest(ctx, fnMiddleware) {
    const res = ctx.res;
    res.statusCode = 404;                         // 没有调用response.writeHead时的默认响应状态码
    const onerror = err => ctx.onerror(err);      // 中间件的错误处理
    const handleResponse = () => respond(ctx);    // 处理请求,根据请求返回正确的状态码和内容
    onFinished(res, onerror);                     // Execute a callback when a HTTP request closes, finishes, or errors.
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);   // fnMiddleware为compose(this.middleware)返回的Promise
  }
```
`fnMiddleware(ctx).then(handleResponse).catch(onerror)`可以理解为3个步骤:
1. fnMiddleware(ctx): 开始执行第一个中间件(可通过next调用下一个中间件)
2. then(handleResponse): 一般中间件中我们会根据请求来设置ctx.body等字段,中间件调用结束之后,koa根据会根据ctx对象来对设置response(响应的相关内容)。例如通过response.end(body)或者body.pipe(res)来设置响应内容体
3. catch(error): 捕获中间件执行时可能发生的异常

koa作为web框架,提供了一种可控制异步流程的中间件调用方式,并根据中间件处理后的结果来设置响应的相关内容

#### 结语

本文大致讲了一下koa的执行流程,更多细节见[源码注释](https://github.com/julyL/LearnNode/tree/master/koa2%E7%9B%B8%E5%85%B3/koa2%E6%BA%90%E7%A0%81)