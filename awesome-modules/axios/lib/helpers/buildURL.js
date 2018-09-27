'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
  // 以下字符可以在url中存在而不需要进行编码,这样更加直观。
  // 一般服务器处理会将url中?后面中出现的'+'作为空格处理,浏览器中也会自动将空格替换'+'
  replace(/%40/gi, '@').
  replace(/%3A/gi, ':').
  replace(/%24/g, '$').
  replace(/%2C/gi, ',').
  replace(/%20/g, '+'). // encodeURIComponent(" ") === '20%'
  replace(/%5B/gi, '[').
  replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
// 将params序列化之后添加到url上
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    // 用paramsSerializer对params进行序列化
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    // URLSearchParams对象调用toString就可以获得原序列化字符串
    // var paramsString = "q=URLUtils.searchParams&topic=api";
    // var searchParams = new URLSearchParams(paramsString);
    // searchParams.toString() == 'q=URLUtils.searchParams&topic=api'
    serializedParams = params.toString();
  } else {
    // 进行默认序列化
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      // 过滤值为null和undefined
      if (val === null || typeof val === 'undefined') {
        return;
      }

      // {arr:[2,3],key1:'val1'} => 'arr[]=2&arr[]=3&key1=val1'
      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};