## Vue中的data

vue通过`initData`方法实现data选项的初始化

```js
function initData(vm) {
  var data = vm.$options.data;
  // 如果data是函数，则执行函数并将返回值赋给vm._data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {};
  if (!isPlainObject(data)) {
    data = {};
    warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    );
  }
  // proxy data on instance
  var keys = Object.keys(data);
  var props = vm.$options.props;
  var methods = vm.$options.methods;
  var i = keys.length;
  while (i--) {
    var key = keys[i];
    {
      // 是否和methods中的字段有冲突
      if (methods && hasOwn(methods, key)) {
        warn(
          ("Method \"" + key + "\" has already been defined as a data property."),
          vm
        );
      }
    }
    // 是否和props中的字段有冲突
    if (props && hasOwn(props, key)) {
      warn(
        "The data property \"" + key + "\" is already declared as a prop. " +
        "Use prop default value instead.",
        vm
      );
    } else if (!isReserved(key)) { // 是否含有$、_字符, Vue内置的一些字段以$和_开头
      // 将key的get、set操作代理到_data对象上  this[key] => this._data[key]
      proxy(vm, "_data", key);
    }
  }
  // observe data
  // 将data变为响应式的关键
  observe(data, true /* asRootData */);
}

```

Vue中data选项支持2种数据类型(函数和纯对象)，`initData`首先会判断data是否为函数，如果是函数则将执行后的返回值赋给vm._data。data支持函数主要是为了让保证每个子组件的data都保持一份各自的引用。

接着遍历data上的所有key,并检测key是否合法

   1. methods中是否定义同名key
   2. props中是否定义同名key
   3. 判断是否和Vue内置的字段冲突

如果key合法，则执行proxy(vm, "_data", key)。proxy相关代码如下：

```js
var sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
};

function proxy(target, sourceKey, key) {
  sharedPropertyDefinition.get = function proxyGetter() {
    return this[sourceKey][key]
  };
  sharedPropertyDefinition.set = function proxySetter(val) {
    this[sourceKey][key] = val;
  };
  Object.defineProperty(target, key, sharedPropertyDefinition);
}
```

proxy方法会通过Object.defineProperty将key代理到`vm._data`上。

`initData`在最后会执行`observe`将data变为可响应式

### observer的实现

```js
function observe(value, asRootData) {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  var ob;
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // value已经observe过了,__ob__存储observer对象
    ob = value.__ob__;
  } else if (
    shouldObserve &&             // vue内部的全局字段，用于控制是否进行observe
    !isServerRendering() &&      // 不是服务端渲染
    (Array.isArray(value) || isPlainObject(value)) &&  // 只有数组和纯对象需要进行observe
    Object.isExtensible(value) &&   // 判断一个对象是否是可扩展的（是否可以在它上面添加新的属性）可以通过Object.preventExtensions()、Object.freeze() 以及 Object.seal()设置为不可扩展
    !value._isVue
  ) {
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob
}
```

observe会判断value是否满足以下几点条件：

1. 不是VNode类型
2. `value.__ob__`不是Observer的实例 (防止重复Observer)
3. shouldObserve为true（Vue源码闭包内的“全局字段”，用于控制是否进行observe的开关）
4. 排除服务端渲染
5. 必须是数组或者纯对象
6. 可扩展属性 (因为需要设置get、set)

满足条件的会value最终会执行`new Observer(value)`

### Observer

```js
var Observer = function Observer(value) {
  // 存储value值
  this.value = value;
  // 依赖管理相关
  this.dep = new Dep();
  this.vmCount = 0;
  // 添加不可枚举字段__ob__，__ob__就是Observer实例对象本身, 可以用于标记已经进行observer
  def(value, '__ob__', this);
  if (Array.isArray(value)) {
    // 数组的observer处理,主要是对arrayMethods方法的“拦截”
    if (hasProto) {
      // 存在__proto__, 则 value.__proto__ = arrayMethods
      protoAugment(value, arrayMethods);
    } else {
      // 通过Object.defineProperty添加arrayMethods
      copyAugment(value, arrayMethods, arrayKeys);
    }
    // 对数组中的每个值都执行observe方法
    this.observeArray(value);
  } else {
    // 纯对象处理
    this.walk(value);
  }
};
```

Observer构造函数的作用是将value包裹成一个**具备响应式的对象**。this.value用于存储包裹前原有的值, dep用于收集的依赖。接着添加了`__ob__`字段,并且值为Observer对象本身。

接着,构造函数Observer会根据value是数组还是对象进行不同的处理。

#### Observer中对于纯对象的处理

```js
// value为纯对象
this.walk(value);

Observer.prototype.walk = function walk(obj) {
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    defineReactive$$1(obj, keys[i]);
  }
};
```

执行`walk(value)` 会遍历对象的每个key，并执行`defineReactive$$1`。

```js
// 删减部分代码
function defineReactive$$1(
    obj,
    key,
    val,
    customSetter,
    shallow
) {
  // 每个key的闭包内都存在一个dep对象，该对象用于存储与当前key有关的观察者(Watcher实例)
  var dep = new Dep();
  // 对val值进行递归observe，返回val对象的observe对象
  var childOb = !shallow && observe(val);

  Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function reactiveGetter() {
          // Dep.target是一个全局对象,如果有值，则表示当前需要被收集的依赖(Watcher实例）
          if (Dep.target) {
              // depend方法用于收集观察者对象(Watcher)
              dep.depend();
              if (childOb) {
                  childOb.dep.depend();
                  if (Array.isArray(value)) {
                      dependArray(value);
                  }
              }
          }
          return value
      },
      set: function reactiveSetter(newVal) {
          // ... 省略
          val = newVal;
          // 将newVal转换为可观测的对象（递归设置getter、setter）
          childOb = !shallow && observe(newVal);
          dep.notify();
      }
  });
}
```

当执行`defineReactive$$1(obj,key)`时, 每个key的闭包内都会生成2个变量**dep**和**childOb**，这两个变量都是用于收集依赖相关,会被闭包一致引用。接着执行 `Object.defineProperty`对key的get、set方法进行拦截。

先来看get方法：首先会判断`Dep.target`变量是否存在,如果存在会进入if语句内进行**依赖收集**。 `Dep.target`是整个Vue源码内的“全局变量”, Vue会在需要进行依赖收集时, 将`Dep.target`赋值为当前依赖本身(实际上就是Watcher对象)。然后通过执行`dep.depend`收集依赖。

set方法：首先将新值newValue进行observe化, 这样做是为了新添加的属性也具备响应式。接着通过`dep.notify`执行依赖。(执行dep.depend收集的依赖)

> Vue收集依赖的过程: 将`Dep.target`赋值为依赖本身,然后触发需要收集这个依赖的key的get方法, 每个key闭包内的dep和childOb.dep就会执行depend方法收集依赖。

举个例子: 通常我们会在vue模板中引用一些data的属性，当被引用的属性发生变化时,视图就会自动发生改变，vue是如何做到的呢?

大致过程: vue会在解析模板时生成一个render函数，通过执行render函数可以生成相应的dom结构。当render函数执行时, 由于render函数内部引用了data的一些属性，这会触发这些属性的get方法。在触发get方法之前,vue会将一个renderWatcher(用于视图更新的Watcher对象)赋值给`Dep.target`。这样，模板中引用的属性的各自闭包内的dep就通过depend方法会收集到这个依赖。当这些属性发生变化时会触发set方法, 会通过dep.notify通知renderWatcher进行视图更新。这样就形成了数据和视图的响应式。

dep是每个key都存在的,用来来收集当前key的依赖。而childOb并不是所有key都有值,childOb主要用于Vue.set中

#### Vue.set

示例

```html
 <div id='app'>
   {{person.address}}
   {{list}}
 </div>
```

```js
var vm = new Vue({
    el: "#app",
    data: {
        person: {
            name: "Bob",
            age: 21
        },
        list: [1, 2, 3]
    }
})

// 对象
vm.person.age = 22;                     // 1.触发视图更新
vm.person.address = 'China';            // 2.不会触发视图更新
Vue.set(vm.person, 'address', 'China')  // 3.触发视图更新

// 数组
vm.list[0] = 22;         //4.不会触发视图更新
vm.list.splice(2, 1, 22) //5.触发视图更新
Vue.set(vm.list, 0, 22)  //6.触发视图更新

```

在讲解上述几个示例之前，先补充一点前提知识：vue的模板会生成render函数, 而render函数会触发引用的data的get方法。视图能否根据data进行响应式更新,关键在于

`vm.person.age = 22;`会触发视图更新，因为age字段在Vue对data进行Observe化阶段，已经通过`Object.defineProperty`拦截set、get方法。当render函数执行，会通过`depend`方法收集依赖。

`vm.person.address = 'China';` 并不会触发视图更新。虽然render函数执行时会触发address的get方法, 但由于address是**新增字段**。并没有拦截其get、set的操作, 导致对于address的任何get/set操作Vue都无法感知到。

因为在Proxy之前，Javascript中没有任何方法可以拦截对象新增属性的操作。Vue为了做到对新增属性拦截, 提供了Vue.set方法。

`Vue.set(vm.person, 'address', 'China')`可以触发视图, 其实现的关键在于childOb。先来看看vm._data结构:

```js
vm._data = {
    list: [
        2, 3, 4, {
            age: 21,
            __ob__: list[3]的Observer对象
        }
    ],
    person: {
        age: 32,
        name: "Bob",
        __ob__: person的Observer对象
    },
    __ob__: 整个data的Observer对象
}
```

我们注意到data中的属性如果是一个对象或者数组(见observer方法第5点条件)，就会存在一个`__ob__`。这个`__ob__`是在Observer构造函数中定义的，并且等于Observer对象本身。来看一下childOb的定义。

```js
 var childOb = !shallow && observe(val);
```

先不用管shallow字段，shallow在执行Observer时并没有传值。所以`childOb = observe(val)`, 如果val满足一定条件就会返回Observe对象。其中比较重要的条件就是val必须是**纯对象或者数组**。
以上述的person字段为例，childOb就是person这个对象对应的Observer对象,也就是`vm._data.person.__ob__`。person字段闭包内的childOb有值会执行`childOb.dep.depend()`

```js
if(childOb){
  childOb.dep.depend();
}
```

我们先看一下Vue.$set的实现:

```js
// 简化代码
Vue.$set = function(target,key,val){
  // 纯对象处理：
  var ob = (target).__ob__;
  // 保证新添加属性具备响应式
  defineReactive$$1(ob.value, key, val);
  // 触发依赖
  ob.dep.notify();
}
```

这里ob就是childOb, 当执行`Vue.set(vm.person, 'address', 'China')`时，ob对应的是`vm._data.person.__ob__`(也就是person字段闭包里的childOb)。ob.dep.notify触发的是person字段的childOb.dep收集的依赖。  

> 我明明想触发address字段收集的依赖, 为什么要触发person字段的收集的依赖呢?

以模板`{{person.address}}为例`。在触发render函数时，不仅会触发address的get方法,也会触发person的get方法，这意味着address和person收集的依赖是一样的。事实上，
person字段收集到的依赖总是包含address字段的依赖的, 因为address只是person的一个字段, 无论是触发address的get方法还是set方法,都会相应的触发person的get和set方法。

#### Observer处理数组

Observer中对于数组的处理如下

```js
// 简化代码
function Observer(){
  // ...其他代码
  if (hasProto) {
    // 存在__proto__, 则 value.__proto__ = arrayMethods
    protoAugment(value, arrayMethods);
  } else {
    // 通过Object.defineProperty添加arrayMethods
    copyAugment(value, arrayMethods, arrayKeys);
  }
  // 对数组中的每个值都执行observe方法
  this.observeArray(value);
}
```

*arrayMethods是以Array.prototype为原型创建的对象,这个对象上挂载了一些数组的方法*
protoAugment和copyAugment两个方法目的是一致的,都是在value数组上添加`arrayMethods`对象上的一系列数组方法，从而拦截数组的方法。

> 在支持__proto__的环境中， `vm.list.__proto__ === arrayMethods.__proto__ === Array.prototype`, 当对vm.list调用数组方法如push方法时，执行的push是arrayMethods上定义的push而不是原生数组方法

Vue采用`monkey-patching`方式, 首先存储原生数组方法，然后重写数组方法。代码如下：

```js
  // 存储数组原型,主要用于获取原生的数组方法
  var arrayProto = Array.prototype;
  // 以Array.prototype为原型创建对象arrayMethods
  var arrayMethods = Object.create(arrayProto);

  var methodsToPatch = [
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse'
  ];

  methodsToPatch.forEach(function (method) {
    // 存储原生的数组方法
    var original = arrayProto[method];
    // 重写arrayMethods对象上的一些数组方法,达到拦截的效果
    def(arrayMethods, method, function mutator() {
      var args = [], len = arguments.length;
      while (len--) args[len] = arguments[len];
      // 执行数组原先的方法
      var result = original.apply(this, args);
      var ob = this.__ob__;
      // inserted表示数组中新增的元素组成的数组
      var inserted;
      switch (method) {
        case 'push':
        case 'unshift':
          inserted = args;
          break
        case 'splice':
          // splice新增的元素
          inserted = args.slice(2);
          break
      }
      // 对新加入数组的元素进行observe化
      if (inserted) { ob.observeArray(inserted); }
      // notify change
      // 通知相应的观察者
      ob.dep.notify();
      return result
    });
  });
```

重写除了会执行原生的数组方法外，最关键的是会执行ob.dep.notify来通知观察者。以`Vue.set(vm.list, 0, 22)`为例,ob就是·vm.list.__ob__·, 也既是list字段的在`defineReactive$$1`闭包内定义的childOb。

这里需要注意的点是对于数组新增元素时的处理，对于新增的子元素（inserted）需要执行`observeArray(inserted)`让其observe化。

Vue.set中对数组的处理如下：

```js
// 简化代码
Vue.$set = function(target,key,val){
    // 数组响应式处理:
    // 通过splice修改元素，由于splice方法已经被vue拦截,会通过target.__ob__.dep.notify执行依赖
    target.splice(key, 1, val);
    return val
}
```

Vue.set对于数组的处理很简单，通过触发splice修改对应元素。由于splice已经被拦截，实际会触发arrayMethods.splice方法，最终会触发target.__ob__.dep.notify执行依赖。

接下来看数组的示例：

```js
// 数组
vm.list[0] = 22;         // 4.不会触发视图更新
vm.list.splice(2, 1, 22) // 5.可以触发视图更新
Vue.set(vm.list, 0, 22)  // 6.可以触发视图更新
```

* 第4点 由于数组的索引不具备响应式，不能像对象属性那样通过`Object.defineProperty`进行拦截。所以`this.list[2]=22`并不会更新视图。
* 第5、6点最终都会调用被vue重写后的splice方法，通过执行`vm.list.__ob__.dep.notify()`来执行依赖触发视图更新。 和对象一样，数组子元素的get、set都会触发数组本身的get、set。

在get方法中,child.dep.depend()下方还存在以下代码:

```js
// 数组的处理
if (Array.isArray(value)) {
    dependArray(value);
}

function dependArray(value) {
  for (var e = (void 0), i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
```

dependArray的作用是遍历数组value, 并递归调用让每个子元素`dep.depend`来收集依赖，**让数组的每一个子元素收集到和数组本身相同的依赖**。因为数组子元素的改变时，对于数组本身而言也意味着发生了改变。

看如下示例：

```js
vm.$watch('list', {
    deep: true,
    handler() {
        console.log('trigger watch');
    }
})

Vue.set(vm.list[3], 'name', "Bob")  // trigger watch
```

如果没有`dependArray`, 将不会输出"trigger watch"，因为不执行`dependArray`, 数组子元素将不会收集到list的依赖。
