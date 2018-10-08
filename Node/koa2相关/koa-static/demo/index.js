const Koa = require("koa");
const static = require("koa-static");
const path = require("path");

const app = new Koa();
const staticPath = path.join(__dirname, "./static"); // 设置静态资源根目录

app.use(static(staticPath, {
    maxage: 100000000
}));

app.use(async (ctx, next) => {
  ctx.body = "<a href='./1.jpg'>图片链接</a>";
});


app.listen(3000);
console.log("[demo] start-quick is starting at port 3000");
// 访问 http://localhost:3000/1.jpg