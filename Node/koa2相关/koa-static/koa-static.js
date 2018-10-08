
'use strict'

/**
 * Module dependencies.
 */

const debug = require('debug')('koa-static')
const { resolve } = require('path')
const assert = require('assert')
const send = require('koa-send')

/**
 * Expose `serve()`.
 */

module.exports = serve

/**
 * Serve static files from `root`.
 *
 * @param {String} root
 * @param {Object} [opts]
 * @return {Function}
 * @api public
 */

function serve(root, opts) {
    opts = Object.assign({}, opts)

    assert(root, 'root directory is required to serve files')

    // options
    debug('static "%s" %j', root, opts)
    opts.root = resolve(root)  // 设置静态资源的根目录
    if (opts.index !== false) opts.index = opts.index || 'index.html'  // 没有设置index,默认返回index.html

    // 默认opts.defer就为假值,等到send方法处理之后再执行next
    if (!opts.defer) { 
        return async function serve(ctx, next) {
            let done = false

            // koa-static中只有GET和HEAD请求可以请求静态资源
            // HEAD: 只返回资源的头部信息  GET: 返回资源的头部和主体内容   
            if (ctx.method === 'HEAD' || ctx.method === 'GET') {
                try {
                    done = await send(ctx, ctx.path, opts)
                } catch (err) {
                    // 这里status只可能为404和500,404是没有找到资源时属于正常情况,500属于程序运行发生的异常情况需要将错误抛出
                    if (err.status !== 404) {  
                        throw err
                    }
                }
            }
            // 如果没有找到资源,则交给后续的中间件处理
            if (!done) {       
                await next()     
            }
        }
    }
    // opts.defer设置为true时,会等到后续中间件执行完之后在进行处理
    return async function serve(ctx, next) {
        await next()

        if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return
        // response is already handled
        // body不为null或者status不为404, 说明其他中间件已经处理这次请求,不需要send方法再进行处理,否则会覆盖其他中间件的处理结果
        if (ctx.body != null || ctx.status !== 404) return // eslint-disable-line

        try {
            await send(ctx, ctx.path, opts)
        } catch (err) {
            if (err.status !== 404) {
                throw err
            }
        }
    }
}
