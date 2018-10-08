'use strict';

var defaults = require('./../defaults');
var utils = require('./../utils');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
// 由于新建的Axios对象属性通过utils.extend扩展到了axios实例上,所以可以直接对axios.defaluts、axios.interceptors进行修改
function Axios(instanceConfig) {
  this.defaults = instanceConfig;        // 一些默认设置项
  this.interceptors = {
    request: new InterceptorManager(),   // request拦截器
    response: new InterceptorManager()   // response拦截器
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }
  // 进行配置项的合并  优先级: Axios默认的defaults < Axios.defaults < 调用时axios请求方法时传入的config
  config = utils.merge(defaults, {
    method: 'get'               // 默认为get方法
  }, this.defaults, config);
  config.method = config.method.toLowerCase();

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined]; // dispatchRequest封装了对于发起ajax的逻辑处理
  var promise = Promise.resolve(config);

  // request拦截器的执行顺序是: 先加入后执行
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  // 而response拦截器则是: 先加入的先执行
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  /*
    假如我们分别添加了2个request和respnse拦截器, 那么最终执行顺序如下:
    request.interceptor2 => request.interceptor1 => [dispatchRequest, undefined] => response.interceptor1 => response.interceptor2
    内部通过promise.then形成promise链, 从而将chain中拦截器的调用串联起来, dispatchRequest是对于ajax请求发起的封装实现,也会返回一个Promise对象
  */
  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

// 在Axios.prootype上挂载delete,get,head,options等别名方法,方便开发者直接使用
// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function (url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function (url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
      // 注意data和params的区别,params是URL参数对象会被序列化,get请求、post请求都可以设置params。但是只有post,put,patch方法可以设置data)
    }));
  };
});

module.exports = Axios;