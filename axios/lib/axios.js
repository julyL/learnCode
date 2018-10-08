'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
// createInstance通过在Axios.prototype.request对象上扩展从而形成一个axios实例
// 为什么不直接在Axios上实现直接new Axios返回axios实例呢? 可能是为了方便直接使用axios(config)而不需要axios.get吧..
function createInstance(defaultConfig) {
  // 根据默认设置 新建一个Axios对象
  var context = new Axios(defaultConfig);

  // axios中所有的请求[axios, axios.get, axios.post等...]内部调用的都是Axios.prototype.request,见[./code/Axios.js]
  // 将Axios.prototype.request的内部this绑定到新建的Axios对象上,从而形成一个axios实例
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context); // 将Axios.prototype属性添加到instance上,如果属性为函数则绑定this为context后再添加

  // Copy context to instance
  utils.extend(instance, context); // 将新建的Axios对象属性添加到instance,同上

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(utils.merge(defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;