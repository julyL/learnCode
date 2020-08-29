## Vue中的data

以如下示例进行讲解：

```js
var vm = new Vue({
    el: "#app",
    data: {
        person: {
            name: "Bob",
            age: 21
        }，
        list: [2, 3, 4, { age : 21 }]
    }
})
```

vue在初始化data过程中主要是通过`initData`实现的,initData代码如下

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

* Vue中data选项支持2种数据类型(函数和纯对象)，`initData`首先会判断data是否为函数，如果是函数则将执行后的返回值赋给vm._data。data支持函数主要是为了让保证每个子组件的data都保持一份各自的引用。
* 接着遍历data上的所有key,并检测key是否合法
   1. methods中是否定义同名key
   2. props中是否定义同名key
   3. 判断是否和Vue内置的字段冲突
如果key合法，则执行proxy(vm, "_data", key) 将key代理到_data上
* 最后执行`observe`将data变为可响应式的关键

### observer

来看一下observer方法

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

observer主要任务是： 对满足一定条件的value执行`new Observer(value)`, 条件如下：

1. 不是VNode类型
2. value.__ob__不是Observer的实例 (防止重复Observer)
3. shouldObserve为true   // Vue源码闭包内的“全局字段”，用于控制是否进行observe的开关
4. 排除服务端渲染
5. 必须是数组或者纯对象
6. 可扩展属性 (因为需要设置get、set)

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

Observer构造函数的作用是将value包裹成一个**具备响应式的对象**。this.value用于存储包裹前原有的值, dep用于收集的依赖。接着添加了__ob__字段,并且值为自身。__ob__字段主要用于标记已经进行过Observer。

**注：文中出现的依赖，可以理解为观察者。收集依赖是监听观察者，执行依赖是通知观察者（观察者往往会触发dom更新、执行对应的watch、computed方法等）。事实上，在Vue中所有的观察者都是一个个Watcher实例对象,这个在之后再章节详细展开讲**

接着,构造函数Observer会根据value是数组还是对象进行不同的处理,先来看看对象的处理

#### 纯对象的Observer处理

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

当执行`defineReactive$$1(obj,key)`时, 会在生成2个变量dep和childOb，这两个变量都是用于依赖管理，并且会被闭包一直引用。接着执行 `Object.defineProperty`对key的get、set方法进行拦截。

先来看get方法：首先会判断Dep.target变量是否存在,如果存在会进入if语句内进行一系列操作。这些操作的目的只有一个：就是收集依赖。 Dep.target是整个Vue源码内的“全局变量”, Vue会在需要进行依赖收集时, 将Dep.target赋值为当前依赖本身(一个个Watcher实例对象), 接着会执行dep.depend，向dep中存储依赖。

set方法中：会将新值newValue进行observe化, 并且通过dep.notify执行依赖(get方法收集的)

举个例子: 通常我们会在vue模板中引用一些data的属性，当被引用的属性发生变化时,视图就会自动发生改变，vue是如何做到的呢?

大致原理: vue会在解析模板时生成一个render函数，通过执行render函数可以生成相应的dom结构。当render函数执行时, 由于render函数内部引用了data的一些属性，这会触发这些属性的get方法。 在触发get方法之前,vue会将一个更新视图的依赖(renderWatcher)赋值给Dep.target。这样，模板中引用的属性的各自的dep字段就通过depend方法会收集到这个依赖。
当这些属性发生变化时会触发set方法, 会通过dep.notify通知renderWatcher进行视图更新。这样就形成了数据和视图的响应式。

childOb主要用于Vue.set方法中,下面将通过示例讲解：

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
vm.person.age = 22;   //  1. 可以触发视图更新
vm.person.address = 'China';  // 2. 不会触发视图更新
Vue.set(vm.person, 'address', 'China')  // 3.可以触发视图更新

// 数组
vm.list[0] = 22; // 4.不会触发视图更新
vm.list.splice(2, 1, 22) //5.可以触发视图更新
Vue.set(vm.list, 0, 22)  //6.可以触发视图更新

```

`vm.person.age = 22;`会触发视图更新，因为age字段在Vue对data进行observe化阶段，已经通过`Object.defineProperty`拦截set、get方法。当render函数执行，会通过`depend`方法收集依赖。

`vm.person.address = 'China';` 并不会视图更新。虽然render函数执行时会触发address的get方阿飞, 但由于address是**新增字段**, 并不会执行`Object.defineProperty`拦截其get、set的操作。导致address的dep并没有收集到依赖(dep压根不存在)。

`Vue.set(vm.person, 'address', 'China')`可以触发视图, 其实现的关键在于childOb。先来看看vm._data结构

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

我们注意到data中的属性如果是一个对象或者数组，就会存在一个__ob__。这个__ob__是通过Observer构造函数中定义过，并且执行Observer对象本身。来看一下childOb的定义。

```js
 var childOb = !shallow && observe(val);
```

先不用管shallow字段，shallow在observe过程并没有传,为undefined。
以person字段为例，childOb就是person这个对象对应的Observer对象。我们看到在get方法中会判断childOb是否存在

```js
if(childOb){
  childOb.dep.depend();
}
```

对于person字段,会执行`childOb.dep.depend`会收集依赖。为什么要执行这一步?

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

这里ob就是childOb, 还是上面这个例子: 当执行`Vue.set(vm.person, 'address', 'China')`时，ob对应的是person的Observer对象(也就是person字段闭包里的childOb)。ob.dep.notify触发的是person字段的childOb.dep收集的依赖。  

**我明明想触发address字段对应的依赖,为什么会触发person字段的依赖呢?**  
因为person字段的依赖是包含address字段的依赖的, address只是person的一个字段, 无论是触发address的get方法还是set方法,都会相应的触发person的get和set方法。以模板`{{person.address}}为例`。在触发render函数时，不仅会触发address的get方法,也会触发person的get方法。这两个get方法收集的依赖都是一样的。

#### 数组observe处理

4、5、6示例都是对数组的操作, 在此之前我们了解Vue是如何对数组进行响应式处理的。

```js
// Observer中数组的处理,简化
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

重写除了会执行原生的数组方法外，最关键的是会执行ob.dep.notify来通知观察者。以`Vue.set(vm.list, 0, 22)`为例,ob就是vm.list.__ob__, 也既是list字段的在`defineReactive$$1`闭包内定义的childOb。

这里需要注意的点是对于数组新增元素时的处理，对于新增的子元素（inserted）需要执行`observeArray(inserted)`让其observe化。

Vue.set中数组的处理，如下：

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
* 5、6操作最终都会调用被vue重写后的splice方法，通过执行`vm.list.__ob__.dep.notify()`来执行依赖触发视图更新。vm.list.__ob__对应list字段闭包内的childOb。 和对象一样，数组子元素的get、set都会触发数组本身的get、set。

**总结：childOb.dep.depend()的目的就是为了通过`Vue.$set`新增属性时能够具备响应式。**

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

dependArray的作用是遍历数组value, 并调用每个子元素dep.depend来收集依赖，**让数组的每一个子元素收集到和数组本身相同的依赖**。因为数组子元素的改变时，对于数组本身而言也意味着发生了改变,也需要执行依赖(子元素的依赖和数组本身的依赖).

本质上是因为数组的索引不具备响应式,看如下示例：

```js
vm.$watch('list', {
    deep: true,
    handler() {
        console.log('trigger watch');
    }
})

Vue.set(vm.list[3], 'name', "Bob")  // trigger watch
```

如果没有dependArray,将不会输出"trigger watch"，因为子元素不会收集到这个属于数组本身的Watcher。虽然我们观察的是list数组，但是数组子元素的改变也等同于数组本身发生了改变。所以数组自身的依赖，也需要通过dependArray让所有子元素递归收集依赖。
