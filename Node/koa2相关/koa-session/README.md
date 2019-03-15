## koa-session
> koa-session 在ctx对象上扩展了ctx.session和ctx.sessionOptions对象

基本使用
```js
 app.use(koaSession(option, app))
```

option设置项
```
option = {
    // cookie存储相关
    key,               // 存储cookie的key值 (默认为"koa:sess")
    maxAge,            // 有效期一天,默认为1天
    overwrite,         // 
    httpOnly,          // 
    signed,            // 
    // 其他
    rolling,           // 直接更新cookie,这样每次请求都会更新cookie使得客服端的cookie不容易过期
    renew,             // cookie有效期过了一半时更新cookie
    autoCommit,        // ctx.session改变之后自动设置cookie
    encode,            // 存储sessionj进行的编码,默认采用base64
    decode,            // 对于的解码方法
    store,             // 需要存储session到外部时(如存在mysql、redis中),需在store对象上实现(get、set、destroy)
    ContextStore,      // ContextStore会覆盖store的设置,一般用于测试时mock
    genid,             // 生成外部存储时所用的key, 用于从外部存储中获取session
    beforeSave         // 存储session时触发的回调
}
```

### 注意点
1. cookie是客户端的,session是服务端的。http时无状态的，服务端需要根据cookie来获取session进行用户认证
2. 存储session的方法有2种, 1种是直接将session存储在cookie中，这种方式比较简单,但存在大小限制和安全顾虑。另一种是cookie中存一个externalKey,通过这个externalKey再去外部存储(mysql或者redis)中得到真正的session。一般采用第一种方式进行存储,并且要保证session中只保存必要的信息。第二种方式常用于需要实现session共享机制的架构中

### 基本流程

1. 根据cookie获取需要操作的session (外部存储时通过initFromExternal获取session,如果session直接存储在cookie中则直接initFromCookie)
2. 调用next()执行其他中间件,可以处理ctx.session
3. 其他中间件处理完之后,会调用commit()把更新后的session保存下来。

### 何时更新
> 是否更新cookie,由【./context.js】内的_shouldSaveSession方法控制

1. session内容改变 (change)
2. maxAge改变 (force)
3. 设置了opt.rolling,会总是更新cookie (rolling)
4. 设置了opt.renew,则会在有效期过半时更新cookie (renew)