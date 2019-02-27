const crypto = require('crypto')
const Koa = require('koa')
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

router.get('/crypto', async (ctx, next) => {
    const salt = crypto.randomBytes(128).toString('base64')
    const hash = crypto.pbkdf2Sync('crypto', salt, 10000, 64, 'sha512').toString('hex')

    ctx.body = {
        hash: hash
    }
    console.log(hash)

    ctx.status = 200
    next()
});

let reqNum = 0
router.get('/empty', async (ctx, next) => {
    let start = new Date();
    ctx.body = {
        hash: 'empty'
    }
    reqNum++;

    ctx.status = 200;
    console.count('ajax')
    next()
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(3000, () => {
    console.log("listen 3000")
})