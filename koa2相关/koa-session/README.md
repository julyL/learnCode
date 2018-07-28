### koa-session
[源码注释](https://github.com/julyL/LearnNode/tree/master/koa2%E7%9B%B8%E5%85%B3/koa-session)

简单概述一下koa-session的实现(具体实现见源码注释)
* koa-session做的事其实主要就是在ctx对象上挂载了session对象,并且对ctx.session的get,set做了处理
* ctx.session的get操作: 如果client请求携带了有效的cookie,则通过ctx.cookies.get取到cookie,并将解码之后的cookie值作为ctx.session
* ctx.session的set操作: 
    * 如果是外部存储session(设置了store并实现get,set,destory方法),则通过store.set存储session,仅在cookie中存储用于外部取值的key;
    * 如果是cookie存储,则直接在cookie存储session
    * client端的cookie是通过调用ctx.cookies.set内部设置response.header的Set-Cookie值来实现的

### Session工作原理

当client通过用户名密码请求server并通过身份认证后，server就会生成身份认证相关的session数据，并且保存在内存或者内存数据库。并将对应的sesssion_id返回给client，client会把保存session_id（可以加密签名下防止篡改）在cookie。此后client的所有请求都会附带该session_id（毕竟默认会把cookie传给server），以确定server是否存在对应的session数据以及检验登录状态以及拥有什么权限，如果通过校验就该干嘛干嘛，否则重新登录。
前端退出的话就清cookie。后端强制前端重新认证的话就清或者修改session。

几点注意的地方
* 当session存储在cookie中时,由于cookie在client端是可见的,容易被窃取造成CSRF,所以server端一般会设置只能相同域下才能发请求
* 分布式部署时可通过外部存储session实现session共享(koa-session通过设置项store实现).session的共享的效率不会太高,因为每次都要从外部存储中进行取值
* http是无状态的,借助于Cookie-Session的机制可以实现有状态。但有状态意味着每次请求都必须携带cookies进行身份认证,这无法用于实现RESTful API(RESTful设计原则是无状态的,一般配合JWT认证机制)

#### 相关资料

[聊一聊JWT与session] https://juejin.im/post/5a437441f265da43294e54c3


