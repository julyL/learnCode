### watcher实现

vue内部会通过`initWatch`来实现Watch初始化,代码如下：

```js
  function initWatch(vm, watch) {
    for (var key in watch) {
      var handler = watch[key];
      if (Array.isArray(handler)) {
        // 单个key是支持传数组的
        for (var i = 0; i < handler.length; i++) {
          createWatcher(vm, key, handler[i]);
        }
      } else {
        createWatcher(vm, key, handler);
      }
    }
  }
```

watcher会判断handler是否为数组, 如果是数组则会对数组中的每个子元素都执行`createWatcher`。

```js
  function createWatcher(
    vm,
    expOrFn,
    handler,
    options
  ) {
    // 处理传对象的情况
    if (isPlainObject(handler)) {
      options = handler;
      handler = handler.handler;
    }
    // 传字符串 这个字符串可以为methods的key
    if (typeof handler === 'string') {
      handler = vm[handler];
    }
    return vm.$watch(expOrFn, handler, options)
  }
```

createWatcher的主要工作是参数格式化统一处理，因为watch选项支持多种形式的传参

```js
watch: {
    someKey1: [handle1, handle2],  // 数组
    someKey2: "handle3",           // 字符串 可以是methods中的名称
    someKey3: handle4              // 函数
    someKey4: {                    // 对象
      handler(){}
    }
}
```

createWatcher进行参数格式化处理后，最终会执行vm.$watch来创建Watcher对象。

```js
  Vue.prototype.$watch = function (
    expOrFn,
    cb,
    options
  ) {
    var vm = this;
    // 直接this.$watch调用时，需要对参数进行统一格式化
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {};
    // user字段用于标记是否由用户自己创建(用于捕获用户错误并提示)
    options.user = true;
    var watcher = new Watcher(vm, expOrFn, cb, options);
    // 设置immediate的Watcher会立即执行
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value);
      } catch (error) {
        handleError(error, vm, ("callback for immediate watcher \"" + (watcher.expression) + "\""));
      }
    }
    // 返回解绑函数
    return function unwatchFn() {
      watcher.teardown();
    }
  };
}
```

$watch实现如下:

1. 判断传入cb是否为纯对象, 如果是则会调用createWatcher进行参数格式化（
2. 标记user为true, 用于标记这个Watcher对象是由用户进行创建的。(而不是Vue自己创建的)。
3. 调用new Watcher创建Watcher实例
4. 如果设置了immediate则立刻执行回调函数。
5. 最后返回当前watcher的解绑函数。

来看一下构造函数Watcher做了什么

```js
var Watcher = function Watcher(
  vm,
  expOrFn,
  cb,
  options,
  isRenderWatcher
) {
  // Vue实例
  this.vm = vm;
  // vue初始化执行mountComponent时,会设置isRenderWatcher=true
  if (isRenderWatcher) {
    vm._watcher = this;
  }
  vm._watchers.push(this);
  // options
  if (options) {
    this.deep = !!options.deep;
    this.user = !!options.user;
    this.lazy = !!options.lazy;
    this.sync = !!options.sync;
    this.before = options.before;
  } else {
    this.deep = this.user = this.lazy = this.sync = false;
  }
  // 回调函数
  this.cb = cb;
  // 标记当前watcher对象的唯一id,并且按照创建时间顺序 递增
  this.id = ++uid$2;
  // 表示当前Watcher对象是否有效，有效的才能执行回调(解绑watcher对象后会设置为false)
  this.active = true;
  // 计算属性内部创建的watcher,会设置lazy为true，表示延迟收集依赖
  this.dirty = this.lazy; // for lazy watchers
  // 存储watcher对象所有dep
  this.deps = [];
  // 存储新增的dep
  this.newDeps = [];
  // 存储depId, 采用Set去重存储
  this.depIds = new _Set();
  // 存储新增的depId
  this.newDepIds = new _Set();
  // watcher对应回调函数字符串化，如果回调函数内部报错，可以在开发阶段给出友好提示
  this.expression = expOrFn.toString();
  // NOTE:依赖收集的关键：getter为一个函数，这个函数执行时会触发各个可观测属性的get方法，各个可观测属性会将当前的Watcher实例对象作为依赖进行收集。这样可观测属性发生变化时,会执行收集到的Watcher的cb。从而实现了watcher机制
  if (typeof expOrFn === 'function') {
    this.getter = expOrFn;
  } else {
    // parsePath作用：返回一个函数，这函数会返回vm中expOrFn对应的值
    // expOrFn='a.b'  => 返回 vm.a.b （注意这个过程会触发a和b的get方法）
    this.getter = parsePath(expOrFn);
    if (!this.getter) {
      this.getter = noop;
      warn(
        "Failed watching path: \"" + expOrFn + "\" " +
        'Watcher only accepts simple dot-delimited paths. ' +
        'For full control, use a function instead.',
        vm
      );
    }
  }
  // 只有计算属性创建的Watcher(或者用户手动设置)lazy才会为true
  // 一般定义watcher会触发this.get
  this.value = this.lazy
    ? undefined
    : this.get();
};
```

Watcher构造函数中定义了很多属性,其中最为核心的是`this.getter`和`this.value`的定义。this.getter定义时会判断`expOrFn`是否为函数。如果是则直接赋值,不是则赋值为`parsePath(expOrFn)`。

如下示例：

```js
// expOrFn为函数fn1
vm.$watch(function fn1() {
    return this.person.age
}, (newVal) => {})

// expOrFn为字符串 "person.age"
vm.$watch("person.age",() => {})
```

parsePath方法接受一个字符串参数，并返回一个函数。这个函数会返回参数字符串所对应的值,上面示例中的`parsePath("person.age")`会返回一个类似于fn1的函数。`this.getter`最终会是一个函数,这个函数的作用是**返回对应属性的值**。

`this.value`根据`this.lazy`来判断是否触发`this.get`方法。`this.lazy`是用于决定依赖收集的时机，如果为false,则不会立刻进行依赖收集。computed在Vue内部也是借助于创建Watcher来实现的,并且computed创建的Watcher对象默认lazy为false。this.lazy只有计算属性创建的Watcher(或者用户手动设置)lazy才会为true。

先不考虑计算属性和手动设置的情况，默认情况下watch选项创建的Watcher对象lazy为false，会立刻执行`this.get`。

```js
Watcher.prototype.get = function get() {
    // 将当前Watcher实例对象设置为Dep.target,会作为依赖被收集
    pushTarget(this);
    var value;
    var vm = this.vm;
    // 将内部this指向vue实例,并执行getter并将vue实例当做参数传入
    value = this.getter.call(vm, vm);
    if (this.deep) {
        // 递归访问value所有属性从而触发get,让每个属性的dep中都收集当前Watcher实例对象
        traverse(value);
    }
    // 设置Dep.target为undefined，关闭依赖收集。这样再触发响应式数据的getter，就不会收集依赖
    popTarget();
    // 对比上一次收集的依赖和当前收集的依赖，对于失效的依赖进行清理和释放
    this.cleanupDeps();
    // 返回值
    return value
};
```

`this.get`方法的作用可以总结为：设置依赖(当前Watcher对象)，触发响应式数据的getter, 在getter方法内部当前Watcher会被对应的dep收集。

这样Watcher对象就会和响应式数据data中的就会建立联系(观察者模式)。 触发响应式数据的setter，会触发对应的Watcher对象执行响应回调。而这些Watcher会负责视图更新(Vue内部会创建负责视图更新的renderWatcher)、执行watch、computed回调等。

`this.get`方法:

1. 执行pushTarget，这一步是将当前Watcher实例赋值给Dep.target。（Dep.target是Vue源码闭包内的“全局变量”)。
2. 接着调用`this.getter`方法, `this.getter`方法会返回对应属性的值。注意：**在这个过程中会触发这些属性的get方法** 由于Dep.target已经被设置为当前Watcher实例, 会执行dep.depend方法将当前Watcher作为依赖收集。如下

```js
// 来自defineReactive$$1
get(){
  if (Dep.target) {
    // 调用depend方法存储当前Watcher对象
    dep.depend();
    ...
  }
}
```

3. 如果设置deep为true, 则执行`traverse(value)`。traverse方法会递归value,触发value上所有属性的get方法。
4. 调用popTarget，设置Dep.target为undefined，关闭依赖收集。这样再触发响应式数据的get方法，就不会收集依赖
5. 执行cleanupDeps方法,cleanupDeps会对比上一次收集的依赖和当前收集的依赖，对于失效的依赖进行清理和释放

接下来配合一些示例进行说明：

```js
watch: {
    // 示例a
    person(newVal, oldVal) {
        console.log('watch person');
    },
    // 示例b
    'person.age'(newVal, oldVal) {
        console.log('watch person.age');
    },
    // 示例c
    person: {
        handler(newVal, oldVal) {
            console.log('watch person deep');
        },
        deep: true
    },
}

vm.$watch(() => {
    return this.person
}, (newVal) => {
    console.log('watch person func')
})

// 触发set
vm.person.age = 22;
```

示例a：new Watcher()过程中"person"的get方法被触发，get方法会调用dep.depend会将当前Watcher实例进行依赖收集。**注意：dep是属于person这个属性的，所以只有person属性执行set方法时，才会执行这个watcher对象的回调**。当执行`vm.person.age = 22`时，回调并不会触发。因为并没有触发age的get方法，使得age的dep并没有收集到这个Watcher实例。

示例b: 在执行`parsePath("person.age")`时，会先后触发person和age的get方法，person和age的dep都会收集watcher对象，所以当触发set时可以通知watcher执行回调。

示例c: 当设置了deep:true, Watcher的get方法会通过traverse方法手动遍历person对象上的所有属性，触发每个属性的get,最终person字段和person上所有的字段都会收集wachter对象，所以也会执行回调。

接下来我们来看看dep,前面说到dep通过depend收集watcher，通过notify通知watcher执行回调。

```js
Dep.prototype.notify = function notify() {
  // stabilize the subscriber list first
  var subs = this.subs.slice();
  if (!config.async) {
    // subs aren't sorted in scheduler if not running async
    // we need to sort them now to make sure they fire in correct
    // order
    // watcher的id按照创建顺序递增
    subs.sort(function (a, b) { return a.id - b.id; });
  }
  // 调用每个Watcher实例对象的update
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update();
  }
};
```

this.subs存储通过dep.depend收集到的watcher对象。如果config.async为false，表示需要同步触发，会对所有watcher按照创建顺序排序。接着会遍历所有watcher并执行watcher.update。

update主要负责执行watcher回调

```js
Watcher.prototype.update = function update() {
  /* istanbul ignore else */
  if (this.lazy) {
    // 计算属性
    this.dirty = true;
  } else if (this.sync) {
    // 同步执行
    this.run();
  } else {
    // 异步执行
    queueWatcher(this);
  }
};
```

this.lazy为true说明是计算属性，计算属性先不展开讲,之后会另写一篇。

如果是同步执行,会执行run方法。run方法会通过`this.get`取到watcher对象最新值value, 然后执行回调函数并传入新值value和旧值oldValue。大致代码如下：

```js
// 做了精简
var value = this.get();
var oldValue = this.value;
this.value = value;
this.cb.call(this.vm, value, oldValue);
```

如果是异步则会执行`queueWatcher`。queueWatcher中涉及很多对于异步队列的处理，这里不展开讲。有兴趣的可以看下源码。但本质上就是：异步的调用run方法，类似于执行`nextTick(()=>{ watcher.run();})`。

```js
function nextTick(cb, ctx) {
  var _resolve;
  callbacks.push(function () {
    if (cb) {
      try {
        cb.call(ctx);
      } catch (e) {
        handleError(e, ctx, 'nextTick');
      }
    } else if (_resolve) {
      // 没有传cb时，nextTick会返回一个Promise对象。当在callbacks执行时,resolve这个Promise对象
      _resolve(ctx);
    }
  });
  // pending用于防止多次执行timerFunc
  if (!pending) {
    pending = true;
    timerFunc();
  }
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(function (resolve) {
      _resolve = resolve;
    })
  }
}
```

callbacks是用于存储回调函数的数组, timerFunc负责异步执行callbacks中的回调。timerFunc会根据当前运行环境的支持情况来进行优雅降级处理，优先采用microtask（Promise、MutationObserver）, 降级时采用Macrotask(setImmediate、setTimeout)。

在Vue中，响应式data改变触发**视图更新(renderWatcher)、watch回调、computed回调**都是异步的。Vue将这些异步操作存储起来，然后在下一个事件循环进行中执行。这样做有几个优势: 1.不会阻塞同步代码的执行  2.data上属性的多次修改不会频繁更新dom,更利于浏览器进行优化。

总结： 在Vue的响应式模式中,Watcher对象主要有3类：负责视图更新的(renderWatcher),负责watch选项的、负责computed选项的。Watcher对象相当于观察者,Vue中的data选项中的key需要订阅相应的观察者来实现**响应式**。Vue通过拦截data中每个字段的get和set方法,当视图、watch、computed中引用了这些字段时，就会触发该字段的get方法, 从而订阅这些观察者。当执行set方法时，就可以通知这些观察者执行相应的处理。

Vue中data中的每个字段都会有一个dep来收集Watcher, dep和watcher的结构如下：

```js
dep = {
  id,
  subs:[watcher,...]
}

watcher ={
  deps: [dep,...],
  ...
}
```
