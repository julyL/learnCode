## 计算属性 computed

通过`initComputed`来初始化计算属性

```js
function initComputed(vm, computed) {
    // 创建一个用于存储的空对象，key 为计算属性，val 为计算属性对应的 Watcher 实例
    var watchers = vm._computedWatchers = Object.create(null);
    for (var key in computed) {
        var userDef = computed[key];
         // Vue 中计算属性支持函数和对象（有 get 方法）
        var getter = typeof userDef === 'function' ? userDef : userDef.get;
        // 将 computed 生成的 Watcher 对象以 key 为键值存储到 watchers 中
        watchers[key] = new Watcher(
            vm,
            getter || noop,
            noop,
            computedWatcherOptions  // {lazy:true}
        );
        defineComputed(vm, key, userDef);
    }
}
```

`initComputed`会遍历 computed 选项对象，对每一个计算属性创建一个 Watcher 实例对象，并执行 `defineComputed`方法。

```js
function defineComputed(target, key, userDef) {
    sharedPropertyDefinition.get = function computedGetter(key) {
        // 取出 key 对应的 Watcher 实例对象
        var watcher = this._computedWatchers && this._computedWatchers[key];
        if (watcher) {
            // dirty 用于控制计算属性是否需要重新计算，true 表示需要重新计算
            if (watcher.dirty) {
                watcher.evaluate();
            }
            if (Dep.target) {
                watcher.depend();
            }
            return watcher.value
        }
    }
    sharedPropertyDefinition.set = noop;
    Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

`defineComputed`会对通过 Object.defineProperty 设置计算属性的 get、set。

当触发计算属性的 get 方法时，会根据计算属性的 Watcher 实例对象的 dirty 值来判断是否需要进行计算。watcher.dirty 为 true 表示需要重新计算。

以下面代码为例：
```js
// html <div id="app"></div>
var vm = new Vue({
    el: "#app",
    data: {
        name: "Bob"
        age: 21
    },
    computed: {
        personInfo() {
            return 'name: ' + this.name + " ,age: " + this.age
        }
    }
})
console.log(vm.personInfo)   // dirty 为 ture, 会进行第一次取值计算。取值计算时会将 personInfo 的 watcher 收集到 name 和 age 中。并设置 dirty 为 false
console.log(vm.personInfo)   // dirty 为 false, 使用缓存
vm.age++;     // 会触发 age 的 set 方法，执行 dep.notify 方法。取出所有订阅的 Watcher 执行 watcher.update 方法。
console.log(vm.personInfo)   // dirty 为 true, 重新计算
```

Vue 会在执行 initComputed 时，为 personInfo 计算属性创建 一个 Watcher 对象。这个计算属性的 Watcher 的有 2 个属性：lazy、dirty。这两个属性是专门用于计算属性的 Watcher, 初始化时为 true。

lazy 用于在新建计算属性的 Watcher 时不会执行计算属性的取值计算。
```js
// Watcher 构造函数
this.value = this.lazy
    ? undefined
    : this.get();   // 会触发计算属性的计算
```

dirty 用于表示计算属性是否需要进行重新计算，为 true 表示需要进行计算

```js
// 计算属性的 Object.defineProperty - get 代码
if (watcher.dirty) {
    watcher.evaluate();
}
```

当第一次执行 vm.personInfo 获取计算属性时，会触发计算属性的 get, 由于计算属性的 watcher 对象的 dirty 初始为 true, 所以会触发 watcher.evaluate。

```js
  Watcher.prototype.evaluate = function evaluate() {
    this.value = this.get();
    this.dirty = false;
  };

  // this.get
  Watcher.prototype.get = function get() {
    // 将当前 Watcher 实例对象设置为 Dep.target, 会作为依赖被收集
    pushTarget(this);
    var value;
    var vm = this.vm;
    try {
      // 将内部 this 指向 vue 实例，并执行 getter 并将 vue 实例当做参数传入
      value = this.getter.call(vm, vm);
    } catch (e) {
    } finally {
      // 设置 Dep.target 为 undefined，关闭依赖收集。这样再触发响应式数据的 getter，就不会收集依赖
      popTarget();
      // 对比上一次收集的依赖和当前收集的依赖，对于失效的依赖进行清理和释放
      this.cleanupDeps();
    }
    // 返回值
    return value
  };
```

触发 this.get 时，此时的 this 是 personInfo 的 Watcher 对象，会通过 pushTarget 方法赋值给 Dep.target 变量，然后执行 this.getter（就是计算属性 personInfo 的计算函数）。执行计算函数时会触发 this.name 和 this.age 的 `Object.defineProperty-get` 方法。将当前 personInfo 的 Watcher 订阅到 name 和 age 的 dep 中。然后通过 popTarget 将 Dep.target 置为 null。

当 this.get 执行完成后，接着将 dirty 设置为 false。这样重复对 personInfo 进行 get 就不会触发重复计算，从而达到缓存计算结果的目的。

当执行 `vm.age++`时，age 的 `Object.defineProperty-set` 方法被触发，会执行 age 对应的 dep 对象的 notify 方法。取出 age 订阅的所有 Watcher, 依次执行 watcher.update 方法。

```js
  Watcher.prototype.update = function update() {
    /* istanbul ignore else */
    if (this.lazy) {
      // 计算属性依赖的值触发了 set 发生了变化，计算属性值需要重新计算
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

在执行 update 方法时，由于计算属性的 lazy 为 true，会将 this.dirty 设置为 true。 **注意此时 personInfo 并没有进行重新计算**，只有对计算属性 personInfo 进行取值操作时才会触发重新计算。

### 思考题

现在 页面 A 引用了 computed B，computed B 依赖了 data C。当 data C 改变时会发生什么。

1. 首先会触发 data C 的 set 方法，会通知订阅的 Watcher 对象
2. 页面 A 的 renderWatcher 会触发，从而触发 computed B 的 get 方法。
3. computed B 重新计算

第 2 点：renderWatcher 是 vue 在初始化解析模板时生成的，解析模板时会触发 computed B 的 get 方法，从而触发 data C 的 get 方法。此时 Dep.target 为 renderWatcher, renderWatcher 会被收集到 data C 的 dep 对象中

### 总结

* 每个计算属性都会创建一个对应的 Watcher 对象，且初始化时不会进行计算
* 触发计算属性的 get 方法时，会通过 watcher.dirty 控制是否需要重新进行计算。

### 资料 

[Vue 原理】月老 Computed - 白话版](https://mp.weixin.qq.com/s?__biz=MzUxNjQ1NjMwNw==&mid=2247484028&idx=1&sn=771e76a666a83edec1ae1105f6e6b60e&chksm=f9a66860ced1e176d91a9bf22f0c5c9c70a761757f319ebc9faa01224409d6d4928f250dbb56&cur_album_id=1619085427984957440&scene=189#rd)