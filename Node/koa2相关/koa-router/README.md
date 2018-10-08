## koa-router源码解析

> koa-router的版本为7.4.0

### 执行过程
> 以如下示例代码进行说明

```js
const Koa = require('koa');
const Router = require('koa-router');
const app = new Koa();

// 1.新建Router对象
var router = new Router();

// 2.注册路由
router.get(path1,middleware1);
router.post(path2,middleware2);

// 3.注册中间件
app.use(router.routes());

app.listen(3000);
```
#### 1.新建Router
```js
// 执行Router构造函数,router结构如下
router = new Router = {
    methods: [],
    stack: [],
    opts,
    params
}
```
#### 2.注册路由
当调用router.get,router.post等方法时,koa-router内部会调用register,register方法主要就是new一个Layer对象并push到router.stack中
```js
// layer结构
layer = new Layer(path, methods, middleware, opts) = {
  path,
  regexp,
  methods: [],
  stack: [],
  ...
}
```
layer对象字段说明: 
1. path为路由注册时路径
2. regexp为根据注册时的path用`path-to-regexp`模块生成的正则,用于匹配路径
3. methods存储路由注册时的请求方法
4. stack存储路由注册时的回调函数
```js
// eg: 有如下路由注册代码
router.post('/user',middleware1)

// 则对应生成的Layer如下
layer = {
    path: '/user',
    regexp: /^\/user(?:\/(?=$))?$/i,
    methods: ['post'],
    stack: [middleware1]
    ...
}
```
#### 3.注册中间件
执行`router.routes`方法会返回一个函数`dispatch`, dispatch接受ctx和next这2个参数,koa-router作为中间件的处理逻辑都集中在了dispatch方法中

**dispatch的执行逻辑:**
1. 内部调用router.match方法,根据请求的method和path查找是否匹配注册过的路由,如果有匹配则返回一个matched对象,如下
```js
matched = {
    path: [],           // 匹配路径的layer对象
    pathAndMethod: [],  // 同时匹配路径和方法的layer对象
    route: false        // 请求是否同时匹配路径和方法
}
// 如果matched.route为假,则执行return next()进行后续中间件的调用,不会执行2、3
```

2. 在ctx对象上挂载router,ctx.router = router; </br>
挂载matched, ctx.matched = matched.path;</br>
挂载_matchedRoute, _matchedRouteName分别对应matched.pathAndMethod数组中最后一个layer对象path和name

3. 在ctx对象上挂载captures, params, routerName. 第2点中挂载的router,matched等属性在处理一个请求时是不会改变的,但captures, params, routerName这3个值则会随着路径规则进行相应改变
```js
// 示例代码: 访问/user/info/22,输出如下
var fn1, fn2;
router.get("/*/*/:id", fn1 = (ctx, next) => {
  console.log(ctx.params.id);   // '22'
  next();
});
router.get("/user/:id/*", fn2 = (ctx, next) => {
  console.log(ctx.params.id);  // 'info'
})
```

由于ctx.params等参数是随路由规则改变的,所以我们只能在回调函数(fn1,fn2)之前,执行挂载params的逻辑,源码如下:
```js
// matchedLayers = matched.pathAndMethod (见上述matched对象说明)
layerChain = matchedLayers.reduce(function (memo, layer) {
    // 注意push进的这个函数是koa2中间件格式的写法,并且内部必须执行return next()。因为compose内部会用Promise包裹这个函数,并且next本身也会返回一个Pormise,只有return next()才能保证中间件按照顺序执行
    memo.push(function (ctx, next) {       
    // 解析captures,params,routerName并挂载到ctx对象上
    ctx.captures = layer.captures(path, ctx.captures);
    ctx.params = layer.params(path, ctx.captures, ctx.params);
    ctx.routerName = layer.name;
    return next();
    });
    return memo.concat(layer.stack); // 在业务代码的回调函数之前插入以上用于挂载的中间件
}, []);

return compose(layerChain)(ctx, next); // compose(layerChain)会返回一个中间件函数,执行中间件会按顺序依次调用layerChain里的中间件
```

#### 结语

本文只是简单讲了一下koa-router大致的执行逻辑，源码的内部还有很多细节并未讲述</br>
读者可自行阅读[源码注释](https://github.com/julyL/Code/Node/blob/master/koa2%E7%9B%B8%E5%85%B3/koa-router/router.js)




