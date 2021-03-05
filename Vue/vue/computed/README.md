### 计算属性 computed

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

`initComputed`会遍历 computed 选项对象，对每一个计算属性创建一个 Watcher 实例对象，并执行 defineComputed。

```js
function defineComputed(target, key, userDef) {
    sharedPropertyDefinition.get = function computedGetter(key) {
        // 取出 key 对应的 Watcher 实例对象
        var watcher = this._computedWatchers && this._computedWatchers[key];
        if (watcher) {
            // 计算属性创建 Watcher 对象时会默认设置 this.dirty=this.lazy=false
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

get 方法内部会取出计算属性对应的 watcher 对象，计算属性的 watcher.dirty 默认会为 false, 会执行`watcher.evalute`。

```js
  Watcher.prototype.evaluate = function evaluate() {
    this.value = this.get();
    this.dirty = false;
  };
```

evaluate 方法会触发 watcher.get 方法。 watcher.get 的任务就是执行计算属性的回调函数（即计算属性的计算方法）。回调函数调用过程中会触发其他属性的 get 方法，当前 watcher 对象会作为依赖被这些属性的 dep 收集。**当其他属性修改时，会通过 dep.notify 执行所有收集 Watcher 对象的回调（包括 computed), 计算属性就会得到更新**。 并且会设置为 dirty 为 true, 防止同一个 watcher.get 多次执行。当`watcher.update`执行之后，dirty 才会再次设置为 true。

接着判断 Dep.target 是否存在，如果存在执行`watcher.depend()`收集依赖。如下

```js
vm.$watch(function fn1() {
    return someComputedKey
}, (newVal) => {
    console.log('fn1')
})
```

触发`watcher.get`方法时，会触发计算属性的 get, 由于此时`Dep.target`存在，需要执行`watcher.depend`收集当前 watcher。
