/**
 * RESTful resource routing middleware for koa.
 *
 * @author Alex Mingoia <talk@alexmingoia.com>
 * @link https://github.com/alexmingoia/koa-router
 */

var debug = require("debug")("koa-router");
var compose = require("koa-compose");
var HttpError = require("http-errors");
var methods = require("methods");
var Layer = require("./layer");

/**
 * @module koa-router
 */

module.exports = Router;

/**
 * Create a new router.
 *
 * @example
 *
 * Basic usage:
 *
 * ```javascript
 * var Koa = require('koa');
 * var Router = require('koa-router');
 *
 * var app = new Koa();
 * var router = new Router();
 *
 * router.get('/', (ctx, next) => {
 *   // ctx.router available
 * });
 *
 * app
 *   .use(router.routes())
 *   .use(router.allowedMethods());
 * ```
 *
 * @alias module:koa-router
 * @param {Object=} opts
 * @param {String=} opts.prefix prefix router paths
 * @constructor
 */

function Router(opts) {
  if (!(this instanceof Router)) {
    return new Router(opts);
  }

  this.opts = opts || {};
  this.methods = this.opts.methods || ["HEAD", "OPTIONS", "GET", "PUT", "PATCH", "POST", "DELETE"];   // 允许设置的路由方法

  this.params = {};
  this.stack = [];    // 存储layer对象   
}

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionaly, `router.all()` can be used to match against all methods.
 *
 * ```javascript
 * router
 *   .get('/', (ctx, next) => {
 *     ctx.body = 'Hello World!';
 *   })
 *   .post('/users', (ctx, next) => {
 *     // ...
 *   })
 *   .put('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .del('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .all('/users/:id', (ctx, next) => {
 *     // ...
 *   });
 * ```
 *
 * When a route is matched, its path is available at `ctx._matchedRoute` and if named,
 * the name is available at `ctx._matchedRouteName`
 *
 * Route paths will be translated to regular expressions using
 * [path-to-regexp](https://github.com/pillarjs/path-to-regexp).
 *
 * Query strings will not be considered when matching requests.
 *
 * #### Named routes
 *
 * Routes can optionally have names. This allows generation of URLs and easy
 * renaming of URLs during development.
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *  // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 * ```
 *
 * #### Multiple middleware
 *
 * Multiple middleware may be given:
 *
 * ```javascript
 * router.get(
 *   '/users/:id',
 *   (ctx, next) => {
 *     return User.findOne(ctx.params.id).then(function(user) {
 *       ctx.user = user;
 *       next();
 *     });
 *   },
 *   ctx => {
 *     console.log(ctx.user);
 *     // => { id: 17, name: "Alex" }
 *   }
 * );
 * ```
 *
 * ### Nested routers
 *
 * Nesting routers is supported:
 *
 * ```javascript
 * var forums = new Router();
 * var posts = new Router();
 *
 * posts.get('/', (ctx, next) => {...});
 * posts.get('/:pid', (ctx, next) => {...});
 * forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());
 *
 * // responds to "/forums/123/posts" and "/forums/123/posts/123"
 * app.use(forums.routes());
 * ```
 *
 * #### Router prefixes
 *
 * Route paths can be prefixed at the router level:
 *
 * ```javascript
 * var router = new Router({
 *   prefix: '/users'
 * });
 *
 * router.get('/', ...); // responds to "/users"
 * router.get('/:id', ...); // responds to "/users/:id"
 * ```
 *
 * #### URL parameters
 *
 * Named route parameters are captured and added to `ctx.params`.
 *
 * ```javascript
 * router.get('/:category/:title', (ctx, next) => {
 *   console.log(ctx.params);
 *   // => { category: 'programming', title: 'how-to-node' }
 * });
 * ```
 *
 * The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
 * used to convert paths to regular expressions.
 *
 * @name get|put|post|patch|delete|del
 * @memberof module:koa-router.prototype
 * @param {String} path
 * @param {Function=} middleware route middleware(s)
 * @param {Function} callback route callback
 * @returns {Router}
 */

methods.forEach(function (method) {
  // 将http请求方法添加到Router原型上
  Router.prototype[method] = function (name, path, middleware) {
    var middleware;

    if (typeof path === "string" || path instanceof RegExp) {
      middleware = Array.prototype.slice.call(arguments, 2); // 调用方式 func(name, path, middleware)
    } else {
      middleware = Array.prototype.slice.call(arguments, 1); // 调用方式 func(path, middleware)
      path = name;
      name = null;
    }

    this.register(path, [method], middleware, {
      name: name
    });

    return this;
  };
});

// Alias for `router.delete()` because delete is a reserved word
Router.prototype.del = Router.prototype["delete"];

/**
 * Use given middleware.
 *
 * Middleware run in the order they are defined by `.use()`. They are invoked
 * sequentially, requests start at the first middleware and work their way
 * "down" the middleware stack.
 *
 * @example
 *
 * ```javascript
 * // session middleware will run before authorize
 * router
 *   .use(session())
 *   .use(authorize());
 *
 * // use middleware only with given path
 * router.use('/users', userAuth());
 *
 * // or with an array of paths
 * router.use(['/users', '/admin'], userAuth());
 *
 * app.use(router.routes());
 * ```
 *
 * @param {String=} path
 * @param {Function} middleware
 * @param {Function=} ...
 * @returns {Router}
 */

Router.prototype.use = function () {
  var router = this;
  var middleware = Array.prototype.slice.call(arguments);
  var path;

  // support array of paths
  if (Array.isArray(middleware[0]) && typeof middleware[0][0] === "string") {
    // router.use(['/users', '/admin'], userAuth()); ==> router.use('/users', userAuth());  +  router.use('/admin', userAuth());
    middleware[0].forEach(function (p) {
      router.use.apply(router, [p].concat(middleware.slice(1)));
    });

    return this;
  }

  var hasPath = typeof middleware[0] === "string";
  if (hasPath) {               // 传path的情况router.use('/path')
    path = middleware.shift(); // 取出path
  }

  // 嵌套路由时,仅需要重新设置内层路由的path,params即可,因为内层路由已经调用过register
  // 不是嵌套路由则需要调用register
  middleware.forEach(function (m) {
    if (m.router) { 
      // router.routes返回的中间件是有router属性的,例如router.use(path,router.routes)
      m.router.stack.forEach(function (nestedLayer) {
        if (path) nestedLayer.setPrefix(path); // 拼接嵌套路由的path '/a' + '/b' => '/a/b'
        if (router.opts.prefix) nestedLayer.setPrefix(router.opts.prefix);
        router.stack.push(nestedLayer);
      });

      // 将外层路由的parms扩展到内层路由的params上方便读取
      if (router.params) {    
        Object.keys(router.params).forEach(function (key) {
          m.router.param(key, router.params[key]);
        });
      }
    } else {
      // 注册路由
      router.register(path || "(.*)", [], m, {
        end: false,
        ignoreCaptures: !hasPath
      });
    }
  });

  return this;
};

/**
 * Set the path prefix for a Router instance that was already initialized.
 *
 * @example
 *
 * ```javascript
 * router.prefix('/things/:thing_id')
 * ```
 *
 * @param {String} prefix
 * @returns {Router}
 */

Router.prototype.prefix = function (prefix) {
  prefix = prefix.replace(/\/$/, "");

  this.opts.prefix = prefix;

  this.stack.forEach(function (route) {
    route.setPrefix(prefix);
  });

  return this;
};

/**
 * Returns router middleware which dispatches a route matching the request.
 *
 * @returns {Function}
 */
// 通过调用router.routes()返回中间件  eg: app.use(router.routes())
Router.prototype.routes = Router.prototype.middleware = function () {
  var router = this;

  var dispatch = function dispatch(ctx, next) {
    // 传给app.use的中间件
    debug("%s %s", ctx.method, ctx.path);

    var path = 
    router.opts.routerPath || ctx.routerPath || ctx.path;
    var matched = router.match(path, ctx.method);
    var layerChain, layer, i;

    if (ctx.matched) { // ctx.matched是数组,存储所有匹配的路径
      ctx.matched.push.apply(ctx.matched, matched.path); // 可以多次调用router.routes()
    } else {
      ctx.matched = matched.path;
    }

    ctx.router = router; // 在ctx对象上挂载router对象

    if (!matched.route) return next(); // 当前请求不匹配时,直接让后续中间处理

    // 当同时匹配多个路由时,会采用最后注册路由的path和name来设置_matchedRoute和_matchedRouteName,对应router.get(name,path,middleware)
    var matchedLayers = matched.pathAndMethod;
    var mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
    ctx._matchedRoute = mostSpecificLayer.path; 
    if (mostSpecificLayer.name) {
      ctx._matchedRouteName = mostSpecificLayer.name;
    }

    // matchedLayers为同时匹配路径和方法的Layer对象组成的数组
    layerChain = matchedLayers.reduce(function (memo, layer) {
      // 注意push进的这个函数是koa2中间件格式的写法,并且内部必须执行return next()。因为compose内部会用Promise包裹这个函数,并且next本身也会返回一个Pormise,只有return next()才能保证中间件按照顺序执行
      memo.push(function (ctx, next) {       
        // 解析captures,params,routerName并挂载到ctx对象上
        ctx.captures = layer.captures(path, ctx.captures);
        ctx.params = layer.params(path, ctx.captures, ctx.params);
        ctx.routerName = layer.name;
        return next();
      });
      return memo.concat(layer.stack); // 在业务代码的回调函数之前插入以上用于挂载的中间件
    }, []);

    return compose(layerChain)(ctx, next); // compose(layerChain)会返回一个中间件函数,执行中间件会按顺序依次调用layerChain里的中间件
  };

  dispatch.router = this; // 在中间件上添加router属性,用于在router.use方法中判断是否是嵌套路由

  return dispatch;
};

/**
 * Returns separate middleware for responding to `OPTIONS` requests with
 * an `Allow` header containing the allowed methods, as well as responding
 * with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.
 *
 * @example
 *
 * ```javascript
 * var Koa = require('koa');
 * var Router = require('koa-router');
 *
 * var app = new Koa();
 * var router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods());
 * ```
 *
 * **Example with [Boom](https://github.com/hapijs/boom)**
 *
 * ```javascript
 * var Koa = require('koa');
 * var Router = require('koa-router');
 * var Boom = require('boom');
 *
 * var app = new Koa();
 * var router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods({
 *   throw: true,
 *   notImplemented: () => new Boom.notImplemented(),
 *   methodNotAllowed: () => new Boom.methodNotAllowed()
 * }));
 * ```
 *
 * @param {Object=} options
 * @param {Boolean=} options.throw throw error instead of setting status and header
 * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
 * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
 * @returns {Function}
 */

Router.prototype.allowedMethods = function (options) {
  options = options || {};
  var implemented = this.methods;

  return function allowedMethods(ctx, next) {
    return next().then(function () {   // next之后调用then,会在所有中间件执行完之后在执行,这里主要是对异常情况的处理
      var allowed = {};

      if (!ctx.status || ctx.status === 404) {
        // 将匹配路径的layer对象的method放入allowed中
        ctx.matched.forEach(function (route) {
          route.methods.forEach(function (method) {
            allowed[method] = method;
          });
        });

        var allowedArr = Object.keys(allowed);

        if (!~implemented.indexOf(ctx.method)) {   // 请求方法不在Router.methods中
          if (options.throw) {
            var notImplementedThrowable;
            if (typeof options.notImplemented === "function") {
              notImplementedThrowable = options.notImplemented(); // set whatever the user returns from their function
            } else {
              notImplementedThrowable = new HttpError.NotImplemented();
            }
            throw notImplementedThrowable;
          } else {
            ctx.status = 501;
            ctx.set("Allow", allowedArr.join(", "));
          }
        } else if (allowedArr.length) {        // 请求的路径匹配
          if (ctx.method === "OPTIONS") {      // OPTIONS用于检测服务器支持哪些HTTP方法,一般作为CORS中的预检请求
            ctx.status = 200;
            ctx.body = "";
            ctx.set("Allow", allowedArr.join(", "));
          } else if (!allowed[ctx.method]) {   // 请求的路径匹配了,但是请求方法不匹配
            if (options.throw) {
              var notAllowedThrowable;
              if (typeof options.methodNotAllowed === "function") {
                notAllowedThrowable = options.methodNotAllowed(); // set whatever the user returns from their function
              } else {
                notAllowedThrowable = new HttpError.MethodNotAllowed();
              }
              throw notAllowedThrowable;
            } else {
              ctx.status = 405;         // 405: Method not allowed,比如应该post请求的写成了get请求
              ctx.set("Allow", allowedArr.join(", "));
            }
          }
        }
      }
    });
  };
};

/**
 * Register route with all methods.
 *
 * @param {String} name Optional.
 * @param {String} path
 * @param {Function=} middleware You may also pass multiple middleware.
 * @param {Function} callback
 * @returns {Router}
 * @private
 */

Router.prototype.all = function (name, path, middleware) {
  var middleware;

  if (typeof path === "string") {
    middleware = Array.prototype.slice.call(arguments, 2);
  } else {
    middleware = Array.prototype.slice.call(arguments, 1);
    path = name;
    name = null;
  }

  // 为path注册methods中的所有方法
  this.register(path, methods, middleware, {
    name: name
  });

  return this;
};

/**
 * Redirect `source` to `destination` URL with optional 30x status `code`.
 *
 * Both `source` and `destination` can be route names.
 *
 * ```javascript
 * router.redirect('/login', 'sign-in');
 * ```
 *
 * This is equivalent to:
 *
 * ```javascript
 * router.all('/login', ctx => {
 *   ctx.redirect('/sign-in');
 *   ctx.status = 301;
 * });
 * ```
 *
 * @param {String} source URL or route name.
 * @param {String} destination URL or route name.
 * @param {Number=} code HTTP status code (default: 301).
 * @returns {Router}
 */

Router.prototype.redirect = function (source, destination, code) {
  // lookup source route by name
  if (source[0] !== "/") {
    source = this.url(source);
  }

  // lookup destination route by name
  if (destination[0] !== "/") {
    destination = this.url(destination);
  }

  return this.all(source, ctx => {
    ctx.redirect(destination); // 采用ctx.redirect进行重定向,默认状态吗301
    ctx.status = code || 301;
  });
};

/**
 * Create and register a route.
 *
 * @param {String} path Path string.
 * @param {Array.<String>} methods Array of HTTP verbs.
 * @param {Function} middleware Multiple middleware also accepted.
 * @returns {Layer}
 * @private
 */

Router.prototype.register = function (path, methods, middleware, opts) {
  opts = opts || {};

  var router = this;
  var stack = this.stack;

  // support array of paths
  if (Array.isArray(path)) {
    // 为数组的话循环执行register
    path.forEach(function (p) {
      router.register.call(router, p, methods, middleware, opts);
    });

    return this;
  }

  // create route
  var route = new Layer(path, methods, middleware, {
    end: opts.end === false ? opts.end : true,
    name: opts.name,
    sensitive: opts.sensitive || this.opts.sensitive || false,
    strict: opts.strict || this.opts.strict || false,
    prefix: opts.prefix || this.opts.prefix || "",
    ignoreCaptures: opts.ignoreCaptures
  });

  if (this.opts.prefix) {
    route.setPrefix(this.opts.prefix);
  }

  // add parameter middleware
  Object.keys(this.params).forEach(function (param) {
    route.param(param, this.params[param]);
  }, this);

  stack.push(route);

  return route;
};

/**
 * Lookup route with given `name`.
 *
 * @param {String} name
 * @returns {Layer|false}
 */

// 根据name查找layer对象
Router.prototype.route = function (name) {
  var routes = this.stack;

  for (var len = routes.length, i = 0; i < len; i++) {
    if (routes[i].name && routes[i].name === name) {
      return routes[i];
    }
  }

  return false;
};

/**
 * Generate URL for route. Takes a route name and map of named `params`.
 *
 * @example
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *   // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 *
 * router.url('user', { id: 3 });
 * // => "/users/3"
 *
 * router.use((ctx, next) => {
 *   // redirect to named route
 *   ctx.redirect(ctx.router.url('sign-in'));
 * })
 *
 * router.url('user', { id: 3 }, { query: { limit: 1 } });
 * // => "/users/3?limit=1"
 *
 * router.url('user', { id: 3 }, { query: "limit=1" });
 * // => "/users/3?limit=1"
 * ```
 *
 * @param {String} name route name
 * @param {Object} params url parameters
 * @param {Object} [options] options parameter
 * @param {Object|String} [options.query] query options
 * @returns {String|Error}
 */

Router.prototype.url = function (name, params) {
  var route = this.route(name);

  if (route) {
    var args = Array.prototype.slice.call(arguments, 1);
    return route.url.apply(route, args);
  }

  return new Error("No route found for name: " + name);
};

/**
 * Match given `path` and return corresponding routes.
 *
 * @param {String} path
 * @param {String} method
 * @returns {Object.<path, pathAndMethod>} returns layers that matched path and
 * path and method.
 * @private
 */

Router.prototype.match = function (path, method) {
  var layers = this.stack;
  var layer;
  var matched = {
    path: [],           // 匹配路径的layer对象
    pathAndMethod: [],  // 同时匹配路径和方法的layer对象
    route: false        // 请求是否同时匹配路径和方法
  }
  // 按照路由注册时的先后顺序对当前client的请求进行匹配, 将匹配的路由放入matched并返回
  // 路由通过调用register方法进行注册
  for (var len = layers.length, i = 0; i < len; i++) {
    layer = layers[i];

    debug("test %s %s", layer.path, layer.regexp);

    if (layer.match(path)) { // 判断path是否匹配
      matched.path.push(layer);

      if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) { // 判断是否匹配method,   ~-1 === 0
        // 
        matched.pathAndMethod.push(layer);
        if (layer.methods.length) matched.route = true; // matched.route用于标记是否匹配
      }
    }
  }

  return matched;
};

/**
 * Run middleware for named route parameters. Useful for auto-loading or
 * validation.
 *
 * @example
 *
 * ```javascript
 * router
 *   .param('user', (id, ctx, next) => {
 *     ctx.user = users[id];
 *     if (!ctx.user) return ctx.status = 404;
 *     return next();
 *   })
 *   .get('/users/:user', ctx => {
 *     ctx.body = ctx.user;
 *   })
 *   .get('/users/:user/friends', ctx => {
 *     return ctx.user.getFriends().then(function(friends) {
 *       ctx.body = friends;
 *     });
 *   })
 *   // /users/3 => {"id": 3, "name": "Alex"}
 *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
 * ```
 *
 * @param {String} param
 * @param {Function} middleware
 * @returns {Router}
 */

Router.prototype.param = function (param, middleware) {
  this.params[param] = middleware;
  this.stack.forEach(function (route) {
    route.param(param, middleware);
  });
  return this;
};

/**
 * Generate URL from url pattern and given `params`.
 *
 * @example
 *
 * ```javascript
 * var url = Router.url('/users/:id', {id: 1});
 * // => "/users/1"
 * ```
 *
 * @param {String} path url pattern
 * @param {Object} params url parameters
 * @returns {String}
 */
Router.url = function (path, params) {
  return Layer.prototype.url.call({
    path: path
  }, params);
};
