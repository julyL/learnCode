/**
 * Module dependencies.
 */

const debug = require('debug')('koa-send')
const resolvePath = require('resolve-path')
const createError = require('http-errors')
const assert = require('assert')
const fs = require('mz/fs')

const {
    normalize,
    basename,
    extname,
    resolve,
    parse,
    sep
} = require('path')

/**
 * Expose `send()`.
 */

module.exports = send

/**
 * Send file at `path` with the
 * given `options` to the koa `ctx`.
 *
 * @param {Context} ctx
 * @param {String} path
 * @param {Object} [opts]
 * @return {Function}
 * @api public
 */

async function send(ctx, path, opts = {}) {
    assert(ctx, 'koa context required')
    assert(path, 'pathname required')

    // options
    debug('send "%s" %j', path, opts)
    const root = opts.root ? normalize(resolve(opts.root)) : ''
    const trailingSlash = path[path.length - 1] === '/'
    path = path.substr(parse(path).root.length)      // 从path中去掉root部分的字符  eg: /xxx/file.js => xxx/file.js
    const index = opts.index
    const maxage = opts.maxage || opts.maxAge || 0
    const immutable = opts.immutable || false
    const hidden = opts.hidden || false      // 为false不会返回路径中有.前缀的文件
    const format = opts.format !== false
    const extensions = Array.isArray(opts.extensions) ? opts.extensions : false
    const brotli = opts.brotli !== false
    const gzip = opts.gzip !== false
    const setHeaders = opts.setHeaders

    if (setHeaders && typeof setHeaders !== 'function') {
        throw new TypeError('option setHeaders must be function')
    }

    // normalize path
    path = decode(path)

    if (path === -1) return ctx.throw(400, 'failed to decode')

    // index file support
    if (index && trailingSlash) path += index    // eg: a.com/b/ =>  a.com/b/index.html    

    path = resolvePath(root, path)

    // hidden file support, ignore
    // 如果path表示的路径中含有.前缀,表明是隐藏文件,默认不返回  eg: static/.gitignore 
    if (!hidden && isHidden(root, path)) return   

    let encodingExt = ''
    // serve brotli file when possible otherwise gzipped file when possible
    // 如果client端接受压缩 && 服务端设置了压缩  && 能在本地找到有相应压缩后缀的文件
    if (ctx.acceptsEncodings('br', 'identity') === 'br' && brotli && (await fs.exists(path + '.br'))) {
        path = path + '.br'
        ctx.set('Content-Encoding', 'br')
        ctx.res.removeHeader('Content-Length')
        encodingExt = '.br'
    } else if (ctx.acceptsEncodings('gzip', 'identity') === 'gzip' && gzip && (await fs.exists(path + '.gz'))) {
        path = path + '.gz'
        ctx.set('Content-Encoding', 'gzip')
        ctx.res.removeHeader('Content-Length')
        encodingExt = '.gz'
    }

    // 设置extensions(文件后缀名) && path中没有后缀,则会添加后缀之后再查找文件
    // eg: extensions中有png, 当请求 /banner时, 会自动查找 /banner.png
    if (extensions && !/\.[^/]*$/.exec(path)) {
        const list = [].concat(extensions)
        for (let i = 0; i < list.length; i++) {
            let ext = list[i]
            if (typeof ext !== 'string') {
                throw new TypeError('option extensions must be array of strings or false')
            }
            if (!/^\./.exec(ext)) ext = '.' + ext   // png => .png
            if (await fs.exists(path + ext)) {      // 添加后缀之后再进行查找
                path = path + ext
                break
            }
        }
    }

    // stat
    let stats
    try {
        stats = await fs.stat(path)   // 根据path判断是否存在相应的本地资源

        // Format the path to serve static file servers
        // and not require a trailing slash for directories,
        // so that you can do both `/directory` and `/directory/`
        if (stats.isDirectory()) {  // 判断是否为目录
            if (format && index) {
                path += '/' + index     // 返回index对应的默认资源 (koa-static默认为index.html)
                stats = await fs.stat(path)
            } else {
                return
            }
        }
    } catch (err) {
        // ENOENT: 表明指定的路径不存在，即给定的路径找不到文件或目录
        // ENOTDIR: 给定的路径虽然存在，但不是一个目录
        // ENAMETOOLONG: 文件名过长
        const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR']
        if (notfound.includes(err.code)) {  // 上面3个err属于预料范畴内的错误, 属于程序正常运行的情况 
            throw createError(404, err)
        }
        // 其他情况则直接报500
        err.status = 500
        throw err
    }

    if (setHeaders) setHeaders(ctx.res, path, stats)

    // 用文件大小设置Content-Length
    ctx.set('Content-Length', stats.size)
    // 没有设置过Last-Modified,则用资源最近的修改时间作为Last-Modified
    if (!ctx.response.get('Last-Modified')) ctx.set('Last-Modified', stats.mtime.toUTCString())
    if (!ctx.response.get('Cache-Control')) {  // 没有设置过Cache-Control时(防止重复设置造成覆盖)
        const directives = ['max-age=' + (maxage / 1000 | 0)]
        if (immutable) {   // 设置Cache-Control为immutable,只要资源在有效期内(没有过期),就不会向Server端发送请求(来验证资源是否过期),可以有效减少304请求
            directives.push('immutable')
        }
        ctx.set('Cache-Control', directives.join(','))
    }
    ctx.type = type(path, encodingExt)     // 设置Content-Type
    ctx.body = fs.createReadStream(path)   // 资源会转换为可读流, 最终通过body.pipe(res)返回给client端

    return path
}

/**
 * Check if it's hidden.
 */

function isHidden(root, path) {
    path = path.substr(root.length).split(sep)
    for (let i = 0; i < path.length; i++) {
        if (path[i][0] === '.') return true
    }
    return false
}

/**
 * File type.
 */

function type(file, ext) {
    return ext !== '' ? extname(basename(file, ext)) : extname(file)
}

/**
 * Decode `path`.
 */

function decode(path) {
    try {
        return decodeURIComponent(path)
    } catch (err) {
        return -1
    }
}
