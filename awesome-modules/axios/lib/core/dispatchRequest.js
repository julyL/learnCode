'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  // 如果设置了cancelToken,并且当执行取消了请求,则抛出异常来表明请求已取消
  // 通过执行cancelToken.sorce().cancel取消请求
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  // 依次调用transformRequest数组中的函数对data,headers进行处理,方便在向服务器发送请求之前对data和headers进行修改(例如对data进行编码加密等)
  // eg: transformRequst = [fn1,fn2]  => 依次执行 fn1(data,headers) 和 fn2(data,headers) 
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;
  // adapter封装了发起请求的逻辑, 内部会根据当前执行环境(浏览器 or Node)来执行响应的代码,adapter相当于一个适配器,抹平了不同平台的差异性,并且提供了统一的接口。
  return adapter(config).then(function onAdapterResolution(response) {
    // 如果手动cancel了请求,则抛出cancel的异常
    throwIfCancellationRequested(config);

    // Transform response data
    // 利用transformResponse对服务器返回的data进行处理
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
  // 执行到这里说明请求出现了异常(代码执行出错或者状态码错误等),但是如果这是执行取消请求操作,那么最终的异常信息还是取消请求所抛出的异常,这样是为了当开发者手动取消请求时,可以对所有取消请求进行统一的后续处理
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};