### 计算属性computed

通过`initComputed`来初始化计算属性

```js
function initComputed(vm, computed) {
    // 创建一个用于存储的空对象,key为计算属性，val为计算属性对应的Watcher实例
    var watchers = vm._computedWatchers = Object.create(null);
    for (var key in computed) {
        var userDef = computed[key];
         // Vue中计算属性支持函数和对象(有get方法)
        var getter = typeof userDef === 'function' ? userDef : userDef.get;
        // 将computed生成的Watcher对象以key为键值存储到watchers中
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

initComputed会遍历computed选项对象，对每一个计算属性创建一个Watcher实例对象,并通过执行defineComputed。

```js
function defineComputed(target, key, userDef) {
    sharedPropertyDefinition.get = function computedGetter(key) {
        // 取出key对应的Watcher实例对象
        var watcher = this._computedWatchers && this._computedWatchers[key];
        if (watcher) {
            // 计算属性创建Watcher对象时会默认设置this.dirty=this.lazy=false
            if (watcher.dirty) {
                watcher.evaluate();
            }
            if (Dep.target) {
               // Dep.target存在时，进行收集依赖
                watcher.depend();
            }
            return watcher.value
        }
    }
    sharedPropertyDefinition.set = noop;
    Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

defineComputed会对通过Object.defineProperty设置计算属性的get、set。 get方法内部会取出计算属性对应的watcher对象，计算属性的watcher.dirty默认会为false, 并且会在执行watcher.evalute之后设置为dirty为true,防止同一个watcher.get多次执行。当watcher.update执行之后，dirty有会设置为true。

evaluate方法会触发watcher.get方法。 watcher.get的任务就是执行计算属性的回调函数(即计算属性的计算方法)。回调函数调用过程中会触发其他属性的get方法，当前watcher对象会作为依赖被这些属性的dep收集。**当其他属性修改时，会通过dep.notify执行所有收集Watcher对象的回调(包括computed),计算属性就会得到更新**
