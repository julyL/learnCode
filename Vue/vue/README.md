
### watcher实现

```js
watch: {
    // 情况[a]
    person(newVal, oldVal) {
        console.log('watch person');
    },
    // [b]
    'person.age'(newVal, oldVal) {
        console.log('watch person.age');
    },
    // [c]
    person: {
        handler(newVal, oldVal) {
            console.log('watch person deep');
        },
        deep: true
    },
}
// [d]
this.$watch(() => {
    return this.person
}, (newVal) => {
    console.log('watch person func')
})
```

vue源码：通过`initWatch`来初始化，initWatch内部会遍历对每一个键值对执行createWatcher,createWatcher主要是进行参数格式化统一处理，最后会通过vm.$watchnew一个Watcher实例对象。

Watcher构造函数(省略)

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

[a、c]的expOrFn为'person' [b]的expOrFn为'person.age'。this.get方法实现了整个Watcher机制

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
    popTarget();
    this.cleanupDeps();
    return value
};
```

**get的主要任务：1.触发访问器属性的 get 拦截器函数，进行依赖收集 2.返回 被观察目标的值**

依赖收集过程：首先通过pushTarget将当前Watcher实例赋值给全局的 Dep.target, 然后调用getter方法。getter方法中如果存在可观察属性(已经进行过observe)，则会触发观察者对象的get拦截器,拦截器内部会将依赖收集。

*例如：

```js
    this.$watch(function expOrFn() {
        return this.a + this.b
    }, cb)
```

调用getter会触发expOrFn，expOrFn内部会执行a、b的get方法，get方法会将依赖cb进行收集。这样当a或者b进行set操作时，就会执行这个依赖cb

情况[a]：new Watcher()过程中"person"的get方法被触发，get方法会调用dep.depend会将当前Watcher实例进行依赖收集。**需要注意：dep是属于person这个属性的，所以只有person属性执行set方法时，才会执行这个watcher对象**。所以当执行`this.person.age = 22`时，[a]回调并不会触发。因为age闭包内的dep并没有收集到这个Watcher实例。
[b]中会触发'age'的get方法，所以会执行回调。
[c]由于设置了deep:true,Watcher的get方法会通过traverse方法手动遍历person对象上的所有属性，触发每个属性的get,所以也会执行回调。

### 计算属性computed

通过`initComputed`来初始化计算属性

```js
function initComputed(vm, computed) {
    // 创建一个用于存储的空对象,key为计算属性，val为计算属性对应的Watcher实例
    var watchers = vm._computedWatchers = Object.create(null);
    for (var key in computed) {
        var userDef = computed[key];
        var getter = typeof userDef === 'function' ? userDef : userDef.get;
        // watchers和vm._computedWatchers是同一引用 ,将computed生成的Watcher对象以key为键值存储到vm._computedWatchers中
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

initComputed会遍历computed对象，对每一个计算属性创建一个Watcher实例对象,并执行defineComputed

```js
function defineComputed(target, key, userDef) {
    sharedPropertyDefinition.get = function computedGetter(key) {
        // 取出key对应的Watcher实例对象
        var watcher = this._computedWatchers && this._computedWatchers[key];
        if (watcher) {
            // Watcher构造函数内部会将 this.dirty=this.lazy；由于计算属性创建Watcher对象时会默认设置lazy=true
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

defineComputed会对计算属性key设置set和get方法,get方法内部会取出key对应的watcher对象，执行watcher.evaluate();evaluate(); evaluate方法会触发watcher.get方法。 watcher.get主要做的事就是执行计算属性的回调函数并返回值。回调函数调用过程中会触发其他属性的get方法，当前watcher对象会作为依赖被这些属性收集收集。**这样当其他属性修改时，计算属性对应的Watcher对象就会被执行,计算属性就会得到更新**
