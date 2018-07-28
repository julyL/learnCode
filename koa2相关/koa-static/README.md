### koa-static

> koa-static在koa-send基础上进行了扩展,简化逻辑如下:
默认情况下接受到请求时,在设置的静态文件目录下查找请求路径的文件是否存在,存在则通过调用 `ctx.body = fs.createReadStream(path)`返回文件,不存在则调用next交给后续中间件处理

[源码注释](https://github.com/julyL/LearnNode/blob/master/koa2%E7%9B%B8%E5%85%B3/koa-static/koa-static.js)