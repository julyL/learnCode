#### 一些疑问
1. Response Header 和 Request Header 中的 max-age有什么区别?
```js
app.use(static(staticPath, {
  maxage: 1000000000
}));
// 没有返回304?
```

2. 什么情况下会返回304? 是在超过max-age和expires有效期时向Server发请求验证资源是否过期 ?