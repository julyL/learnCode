const Koa = require("koa");
const static = require("koa-static");
const path = require("path");

const app = new Koa();
const staticPath = path.join(__dirname, "./static"); // 设置静态资源根目录

/*
  如果不注释以下代码,访问 /1.jpg将会返回 Not Found
  app.use(function (ctx, next) {   
     next();
  });

  正确如下: 
  app.use(async function (ctx, next) {
    await next();
  });
*/
app.use(static(staticPath, {
    maxage: 100000000
}));

app.use(async (ctx, next) => {
  ctx.body = "Hello World";
});


app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");
// 访问 http://localhost:3000/1.jpg