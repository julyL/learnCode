
### connect笔记

* connect的中间件调用方式是一个接一个呈线性的,结构上类似数组。可以通过显示调用next方法调用后续的中间件
* 如果需要通过中间件进行错误处理,则必须将错误通过next(error)的方式传给下一个中间件。并且进行错误处理的“中间件”和普通中间件不同,必须接受4个参数。 
* 路由匹配: route = '/route' 能匹配  req.url的path ∈ ['/route/xxx','/route.xxx','/route', '/Route/xxx', ...]  

```js

app.use(route, handle)

// 普通中间件
handle(req, res, next);

//错误中间件
handle(err, req, res, next)

```















