/*!
 * connect
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var debug = require('debug')('connect:dispatcher');
var EventEmitter = require('events').EventEmitter;
var finalhandler = require('finalhandler');
var http = require('http');
var merge = require('utils-merge');
var parseUrl = require('parseurl');

/**
 * Module exports.
 * @public
 */

module.exports = createServer;

/**
 * Module variables.
 * @private
 */

var env = process.env.NODE_ENV || 'development';
var proto = {};

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
    ? setImmediate
    : function (fn) { process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Create a new connect server.
 *
 * @return {function}
 * @public
 */

function createServer() {
    function app(req, res, next) { app.handle(req, res, next); }
    merge(app, proto);
    merge(app, EventEmitter.prototype);
    app.route = '/';
    app.stack = [];   // 存储所有绑定的中间件,中间件的执行是线性的一个接一个
    return app;
}

/**
 * Utilize the given middleware `handle` to the given `route`,
 * defaulting to _/_. This "route" is the mount-point for the
 * middleware, when given a value other than _/_ the middleware
 * is only effective when that segment is present in the request's
 * pathname.
 *
 * For example if we were to mount a function at _/admin_, it would
 * be invoked on _/admin_, and _/admin/settings_, however it would
 * not be invoked for _/_, or _/posts_.
 *
 * @param {String|Function|Server} route, callback or server
 * @param {Function|Server} callback or server
 * @return {Server} for chaining
 * @public
 */

proto.use = function use(route, fn) {
    var handle = fn;
    var path = route;

    // default route to '/'
    if (typeof route !== 'string') {
        handle = route;
        path = '/';
    }

    // wrap sub-apps
    if (typeof handle.handle === 'function') {
        var server = handle;
        server.route = path;
        handle = function (req, res, next) {
            server.handle(req, res, next);
        };
    }

    // wrap vanilla http.Servers
    if (handle instanceof http.Server) {
        handle = handle.listeners('request')[0];
    }

    // strip trailing slash
    // '/foo/' 和 '/foo' 是等价的, '/foo/' => '/foo' 
    if (path[path.length - 1] === '/') {
        path = path.slice(0, -1);
    }

    // add the middleware
    debug('use %s %s', path || '/', handle.name || 'anonymous');
    this.stack.push({ route: path, handle: handle });

    return this;
};

/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @private
 */

proto.handle = function handle(req, res, out) {
    var index = 0;
    var protohost = getProtohost(req.url) || '';
    var removed = '';
    var slashAdded = false;
    var stack = this.stack;

    // final function handler
    var done = out || finalhandler(req, res, {
        env: env,
        onerror: logerror
    });

    // store the original URL
    req.originalUrl = req.originalUrl || req.url;

    function next(err) {
        if (slashAdded) {
            req.url = req.url.substr(1);
            slashAdded = false;
        }

        if (removed.length !== 0) {   // 复原之前重写的req.url
            req.url = protohost + removed + req.url.substr(protohost.length);
            removed = '';
        }

        // next callback
        var layer = stack[index++];

        // all done
        if (!layer) {
            defer(done, err);
            return;
        }

        // route data
        var path = parseUrl(req).pathname || '/';
        var route = layer.route;

        // route为app.use设置的路由     path为实际请求的pathname    
        // 路由的匹配由[步骤1和步骤2]完成  如果当前中间件设置的路由和请求路由不匹配,则直接调用next来执行后续的中间件

        // 步骤1  首先判断path是否包含于route(不区分大小写), 等价于判断 path.toLowerCase().indexOf(route.toLowerCase()) !== 0
        if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
            return next(err);
        }

        // 步骤2 其次path包含route的同时,path匹配route的后一个字符必须以"/","." or ""结尾   eg: path ∈ ['/a/b','/a.b','/a'] 都能匹配 route = '/a'   
        var c = path.length > route.length && path[route.length];
        if (c && c !== '/' && c !== '.') {
            return next(err);
        }


        // 将req.url重写为 req.url中去掉匹配route之后的部分  
        // eg: req.url = '/a/b' route = '/a'  => req.url = '/b'
        if (route.length !== 0 && route !== '/') {
            removed = route;
            req.url = protohost + req.url.substr(protohost.length + removed.length);

            // ensure leading slash
            if (!protohost && req.url[0] !== '/') {
                req.url = '/' + req.url;
                slashAdded = true;
            }
        }

        // call the layer handle  执行app.use的回调
        call(layer.handle, route, err, req, res, next);
    }

    next();
};

/**
 * Listen for connections.
 *
 * This method takes the same arguments
 * as node's `http.Server#listen()`.
 *
 * HTTP and HTTPS:
 *
 * If you run your application both as HTTP
 * and HTTPS you may wrap them individually,
 * since your Connect "server" is really just
 * a JavaScript `Function`.
 *
 *      var connect = require('connect')
 *        , http = require('http')
 *        , https = require('https');
 *
 *      var app = connect();
 *
 *      http.createServer(app).listen(80);
 *      https.createServer(options, app).listen(443);
 *
 * @return {http.Server}
 * @api public
 */

proto.listen = function listen() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};

/**
 * Invoke a route handle.
 * @private
 */

function call(handle, route, err, req, res, next) {
    var arity = handle.length;   // 获取函数传参个数
    var error = err;
    var hasError = Boolean(err);

    debug('%s %s : %s', handle.name || '<anonymous>', route, req.originalUrl);

    try {
        if (hasError && arity === 4) {  // [错误处理中间件]的参数有4个,并且错误必须传入next(error)中,【错误处理中间件】才能进行处理
            // error-handling middleware
            handle(err, req, res, next);
            return;
        } else if (!hasError && arity < 4) {
            // request-handling middleware
            handle(req, res, next);
            return;
        }
    } catch (e) {
        // replace the error
        error = e;
    }

    // continue
    next(error);   // 传给后续的【错误处理中间件】进行处理
}

/**
 * Log error using console.error.
 *
 * @param {Error} err
 * @private
 */

function logerror(err) {
    if (env !== 'test') console.error(err.stack || err.toString());
}

/**
 * Get get protocol + host for a URL.
 *
 * @param {string} url
 * @private
 */

function getProtohost(url) {
    if (url.length === 0 || url[0] === '/') {
        return undefined;
    }

    var searchIndex = url.indexOf('?');
    var pathLength = searchIndex !== -1
        ? searchIndex
        : url.length;
    var fqdnIndex = url.substr(0, pathLength).indexOf('://');

    return fqdnIndex !== -1
        ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
        : undefined;
}
