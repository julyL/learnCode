## axios 源码解析

### 目录说明

- ./lib 目录存在axios源码文件
- ./demo 目录存放调试用的demo

### 以一个简单示例进行说明

```js
const axios = require('axios');
axios.defaults.baseURL = 'http://xxx.com/api';
axios.interceptors.request.use(resolveFn1, rejectFn2); // 添加请求拦截器
axios.interceptors.response.use(resolveFn2, rejectFn2); // 添加响应拦截器
axios.get('/get').then(() => {
    // 请求成功的处理
  }, () => {
    // 请求异常的处理
  }
);
```

上述代码演示了如何发起axios请求，先从`require('axios')`说起。 `require('axios')`导出值的来自`./lib/axios.js`,而`./lib/axios.js`导出是内部调用createInstance之后的返回值。createInstance方法会返回一个`axios实例`(注：axios.create也可以创建`axios实例`,其内部也是调用createInstance)。我们先来看下createInstance的源码是如何实现的

```js
// ./lib/axios.js
function createInstance(defaultConfig) {
  // 根据默认设置 新建一个Axios对象
  var context = new Axios(defaultConfig);

  // axios中所有的请求[axios, axios.get, axios.post等...]内部调用的都是Axios.prototype.request,见[./code/Axios.js]
  // 将Axios.prototype.request的内部this绑定到新建的Axios对象上,从而形成一个axios实例
  var instance = bind(Axios.prototype.request, context);

  utils.extend(instance, Axios.prototype, context); // 将Axios.prototype属性添加到instance上,如果属性为函数则绑定this为context后再添加

  utils.extend(instance, context); // 将新建的Axios对象属性添加到instance,同上

  return instance;
}
```

首先内部会新建一个Axios对象,Axios结构函数如下
```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;        // 一些默认设置项
  this.interceptors = {
    request: new InterceptorManager(),   // request拦截器
    response: new InterceptorManager()   // response拦截器
  };
}
```
新建的Axios对象主要是用来挂载axios实例的一些设置(如defaults会挂载axios实例的通用设置，interceptors用于存放拦截器)

根据源码可知，axios实例(instance)是对`Axios.prototype.request方法`包裹了一层函数，主要是为将Axios.prototype.request内部的this绑定到新建的Axios对象上。然后通过 utils.extend 将内部**context**和**Axios.prototyp**的属性添加到这个`Axios.prototype.request`方法上，添加上去的函数也会绑定this到新建的Axios对象上。最终的axios实例上面的方法内部的this指向的都是新建的Axios对象，从而使得不同axios实例之间隔离了作用域，可以对每个axios实例设置不同的config

>为什么不将所有方法在Axios上实现然后返回new Axios呢? 

因为axios内部调用的都是Axios.prototype.request方法，Axios.prototype.request默认请求方法为get。为了让开发者可以直接axios(config)就可以发送get请求，而不需要axios.get(config)。如果直接new一个Axios对象是无法实现这种简写的（没错，就是为了少打几个字）

实际上axios.post、axios.put等所有axios的请求方法内部都是调用Axios.prototype.request
```js
// 见./lib/core/Axios
Axios.prototype.request = function request(config) {
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
```

`Axios.protytype.request`内部会进行了一些配置项的合并工作，变量chain相当于一个任务队列，以2个为一组存放任务(1个是任务成功回调，1个是任务失败回调)，通过不断调用promise.then方法形成一个promise链，从而将所有的任务执行串联起来。

**有一点需要注意是拦截器的执行顺序，request 拦截器先加入的后执行，response 拦截器则是先加入的先执行。**


```
 执行顺序示例：request.interceptor2 => request.interceptor1 => [dispatchRequest, undefined] => response.interceptor1 => response.interceptor2
```
request.interceptor用于请求发起前的准备工作(可以修改data和headers)，response.interceptor用于服务器返回数据之后的处理工作（也是对data进行处理），整个请求过程的发起过程是通过dispatchRequest实现的

```js
// 省略部分代码,详细代码见./lib/code/dispatchRequest
function dispatchRequest(config) {
  // ...
  // 依次调用transformRequest数组中的函数对data,headers进行处理,方便在向服务器发送请求之前对data和headers进行修改(例如对data进行编码加密等)
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );
  // ...
  return adapter(config).then(
    function onAdapterResolution(response) {
      // 判断请求是否被取消,如果请求已经被手动取消则会抛出一个异常
      throwIfCancellationRequested(config);

      // Transform response data
      // 利用transformResponse对服务器返回的data进行处理
      response.data = transformData(response.data, response.headers, config.transformResponse);

      return response;
    },
    function onAdapterRejection(reason) {
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
    }
  );
}
```

`transformData(config.data, config.headers, config.transformRequest)`是为了向服务器发送请前对 data 进行处理，可以通过设置transformRequest对data和header进行修改，一般进行加密编码等操作。

adapter 是一个典型的适配器模式的实现, 其默认值为getDefaultAdapter的返回值
```js
// 见./lib/cord/defaults.js
// 根据当前执行环境(浏览器 or Node)执行相应的请求发起逻辑
function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') { // 浏览器环境
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined') { // node环境
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}
```
可以看到adapter内部对不同环境做了适配处理，封装了统一的行为: **根据config发送请求然后返回一个promise，promise的状态根据请求的结果来决定。** 各个环境具体的实现，可自行阅读源码

接下来我们来看下adapter返回promise的成功和失败回调是如何处理的
1. onAdapterResolution方法
  * 调用throwIfCancellationRequested来判断请求是否被取消(axios中可以通过cancelToken取消请求)，如果请求已经被手动取消则会抛出一个异常
  * 调用transformResponse对服务返回的数据进行处理，一般进行解密解码等操作
  * 返回处理之后的response给开发者使用
2. onAdapterRejection
  * 请求失败的原因可分为2种，1种是普通的请求异常(如:后台返回了错误的状态码、代码执行出错等)，另一种是我们手动取消了请求从而抛出的异常，2者可以根据isCancel进行区分。注意：当执行过程同时出现2种异常时，axios返回的异常最终会是**取消请求所抛的异常** 

至此 axios 库的处理流程就结束了。


### 结语

本文大致讲了一下axios的执行原理，更多细节见./lib目录下的源码注释

