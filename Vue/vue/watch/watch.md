### watcher实现

```js
var vm = new Vue({
    el: "#app",
    data: {
        person: {
            name: "Bob",
            age: 21
        }
    },
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
})
// 示例d
vm.$watch(() => {
    return this.person
}, (newVal) => {
    console.log('watch person func')
})

vm.person.age = 22;
// watch person deep
// watch person.age

```

vue源码通过`initWatch`来初始化Watcher

```js
function initWatch(vm, watch) {
  for (var key in watch) {
    var handler = watch[key];
    if (Array.isArray(handler)) {
      // 支持传数组
      for (var i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i]);
      }
    } else {
      createWatcher(vm, key, handler);
    }
  }
}
```

initWatch内部会遍历对每一个键值对执行createWatcher,并且对可以设置的Watcher是支持传数组的

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

Vue的watch对应的键值支持多种形式的设置：对象、函数、字符串, createWatcher主要对键值进行参数格式化统一处理，保证调用vm.$watch的handler为函数

```js
  Vue.prototype.$watch = function (
    expOrFn,
    cb,
    options
  ) {
    var vm = this;
    // 直接在vue中通过this.$watch调用时，需要对参数进行格式化
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {};
    // user字段用于标记是否由用户自己创建,主要用于错误处理的提示
    // (Vue在mouted阶段会自动创建一个renderWatcher,这个Watcher的user为false)
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

1. $watch方法会首先判断cb是否为对象，如果为对象会再次调用createWatcher进行格式化。
主要为了支持`this.$watch`动态进行创建watcher的情况,这时cb可能为对象。
2. 接着设置user=true,user字段用于标记这个Watcher对象是由用户进行创建的。
3. 调用new Watcher创建Watcher实例
4. 如果设置了immediate会立刻执行Watcher回调
5. 返回一个函数用于解绑Watcher

来看一下构造函数Watcher做了什么

```js
function Watcher(
    vm,
    expOrFn,
    cb,
    options,
    isRenderWatcher
  ) {
    //  对应[d]
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn;
    } else {
      // parsePath作用：返回一个函数，这函数会返回vm中expOrFn对应的值
      // expOrFn='a.b'  => 返回 vm.a.b （注意这个过程会触发a和b的get方法）
        this.getter = parsePath(expOrFn);
    }
    // 只有计算属性创建的Watcher(或者用户手动设置)lazy才会为true
    // 一般定义watcher会触发this.get
    this.value = this.lazy
      ? undefined
      : this.get();
}
```

expOrFn有2种数据格式: 函数、字符串。上诉示例代码d中，expOrFn就是一个函数。示例a、b、c中expOrFn则为字符串。当expOrFn为字符串时，会执行`parsePath`会返回一个函数。这个函数会返回expOrFn对应的数据。如示例b： expOrFn为'person.age',执行这个函数会返回vm.person.age。

功能上类似`lodash.get(vm, expOrFn)`，不过`parsePath`方法中只支持.为分隔符。

最终this.getter会始终返回一个函数，其作用是触发一些响应式数据的get方法。

this.lazy是用于决定依赖收集的时机，如果为false,则不会立刻进行依赖收集。computed在Vue内部也是借助于创建Watcher来实现的,并且computed创建的Watcher对象默认lazy为false。

除非手动设置lazy为true，默认情况下创建的Watcher对象lazy为false，会立刻执行this.get。

get方法的作用可以总结为：设置依赖(当前Watcher对象)，触发响应式数据的getter, 在getter方法内部当前Watcher会被对应的dep收集。

这样Watcher对象就会和响应式数据data中的就会建立联系(观察者模式)。 触发响应式数据的setter，会触发对应的Watcher对象执行响应回调。而这些Watcher会负责视图更新(Vue内部会创建负责视图更新的renderWatcher)、执行watch、computed回调等。

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

get方法:

1.执行pushTarget，这一步是将当前Watcher实例赋值给Dep.target。（Dep.target是Vue源码闭包内的“全局变量”)。
2.接着调用getter方法, getter方法会触发响应式data的get方法，由于Dep.target方法被设置为当前Watcher实例, 通过dep.depend方法将当前Watcher作为依赖收集。如下

```js
// 来自defineReactive$$1
get(){
  if (Dep.target) {
    // 调用depend方法存储当前Watcher对象(可以理解为监听了观察者)
    dep.depend();
    ...
  }
}
```

3. 调用popTarget，设置Dep.target为undefined，关闭依赖收集。这样再触发响应式数据的get方法，就不会收集依赖
4. cleanupDeps// 对比上一次收集的依赖和当前收集的依赖，对于失效的依赖进行清理和释放

例如：

```js
this.$watch(function expOrFn() {
    return this.a + this.b
}, cb)
```

调用this.getter()会触发a、b的get方法，get方法会将创建的Watcher对象通过dep.depend进行收集。这样当a或者b进行set操作时，就会通知这个Watcher执行cb。

[a]：new Watcher()过程中"person"的get方法被触发，get方法会调用dep.depend会将当前Watcher实例进行依赖收集。**注意：dep是属于person这个属性的，所以只有person属性执行set方法时，才会执行这个watcher对象的回调**。所以当执行`vm.person.age = 22`时，[a]回调并不会触发。因为并没有触发age的get方法，导致age的dep并没有收集到这个Watcher实例。
[b]中在执行`parsePath("person.age")`时，会先后触发person和age的get方法，person和age的dep都会收集watcher对象，所以触发age的set会执行回调。
[c]当设置了deep:true, Watcher的get方法会通过traverse方法手动遍历person对象上的所有属性，触发每个属性的get,最终person字段和person上所有的字段都会收集wachter对象，所以也会执行回调。

接下来我们来看看dep,前面说到dep通过depend收集watcher，通过notify执行watcher的回调。

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

queueWatcher方法最终会调用`nextTick(flushSchedulerQueue)`,这里的nextTick和Vue.nextTick是同一个方法。

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
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(function (resolve) {
      _resolve = resolve;
    })
  }
}
```

在Vue中响应式数据发生变化之后,dom并不会立刻更新。只有在`this.$nextTick(cb)`的cb中才能确保dom进行了更新。这是Vue刻意进行的优化，Vue首先会将所有的dom更新操作存储起来，并在下一个事件循环中执行。watch回调、computed回调也是一样的处理，是异步执行的。

callbacks就是用于存储的数组,timerFunc就是用于异步执行。timerFunc会根据当前运行环境的支持情况来进行优雅降级处理，优先采用microtask（Promise、MutationObserver）,降级时采用Macrotask(setImmediate、setTimeout).
