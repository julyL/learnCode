module.exports = function(obj, keys) {
  obj = obj || {};
  if ("string" == typeof keys) keys = keys.split(/ +/);  // keys只能是数组或者空格分隔的字符串
  return keys.reduce(function(ret, key) {   // 从obj中取出key值拼成一个新对象
    if (null == obj[key]) return ret;       // 如果obj中的key对应的值为跳null或者undefined,则跳过赋值,因为不赋值默认就是undefined-_-||
    ret[key] = obj[key];
    return ret;
  }, {});
};

