const Koa = require('koa');
const session = require("koa-session");

const app = new Koa();

app.keys = ['keys for cookie'];
app.use(session(app));

app.use(async function (ctx) {
  ctx.session.message = 'hi' + new Date();
  ctx.body = ctx.session;
});

app.listen(4000);