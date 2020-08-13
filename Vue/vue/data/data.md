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

* 我们知道data支持2种数据类型(函数和纯对象)，initData首先会判断data是否为函数，如果是函数则将执行后的返回值赋给vm._data。data支持函数主要是为了让保证每个子组件的data都保持一份各自的引用。 接着判断vm._data不是纯对象,如果不是则进行错误提示。
* 遍历data的所有key,并对key做了以下几点判断
   1. methods中是否定义同名key
   2. props中是否定义同名key
   3. 是否含有$、_字符, 由于Vue已经内置的一些以$和_开头的字段，如果用户再定义会造成冲突
如果key合法，则执行proxy(vm, "_data", key) 将key代理到_data上
* 执行`observe`将data变为可响应式的关键

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

满足以下条件的value会执行`new Observer(value)`

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

Observer构造函数定义了一些变量，并在value上通过`Object.defineProperty`定义了__ob__用于表示自身(obsever对象)。其中需要注意的是dep,dep主要用于存储当前Observer实例的*依赖*。

**注：文中出现的依赖，可以理解为观察者。收集依赖是监听观察者，执行依赖是通知观察者（观察者往往会触发dom更新、执行对应的watch、computed方法等）。事实上，在Vue中所有的观察者都是一个Watcher实例对象,这个在之后再章节详细展开讲**

构造函数Observer对于数组和对象的有着不同的处理方式，先来对象的处理

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

执行`walk(value)` 会遍历对象的每个key，并执行`defineReactive$$1`。vue数据响应式实现的关键在于通过触发getter进行依赖的收集，并在触发setter时自动执行相应依赖。其核心实现都在defineReactive$$1中

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

当执行`defineReactive$$1(obj,key)`时, 会在生成2个变量dep和childOb，这两个变量都是用于依赖管理，并通过闭包存储。接着执行 `Object.defineProperty`对key的get、set方法进行拦截。

先来看get方法，Dep.target是Vue源码闭包内的“全局变量”, Vue会在需要进行依赖收集时,将Dep.target赋值为当前依赖本身(也就是Watcher实例对象),接着执行会执行dep.depend存储Watcher实例。
childOb则主要用于Vue.set方法中，也是通过执行childOb.dep.depend存储依赖。

set方法将新值newValue进行observe化,通过dep.notify执行依赖。

下面将通过代码示例讲解：

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

先简单介绍Vue收集html模板依赖的过程：Vue在mounted阶段会解析el选项对应的html模板生成一个render函数。这个render函数会引用一些响应式数据如上述中的person和list。并且会生成一个Watcher实例(renderWatcher),这个Watcher主要用于视图更新。接着会将这个Watcher对象赋值给Dep.target, 让后执行render函数。由于render函数执行过程中会触发响应式数据的getter,这样可以通过depend方法收集到依赖(Watcher对象)。

`vm.person.age = 22;`会触发视图更新，因为age字段在Vue对data进行observe化阶段，已经通过`Object.defineProperty`拦截set、get方法。当render函数执行，会触发depend方法收集依赖。

`vm.person.address = 'China';` 并不会视图更新。因为address这个字段是**新增字段**，并没有执行`Object.defineProperty`拦截其get、set的操作。所以当触发address的set方法时，自然什么都不会发生。

`Vue.set(vm.person, 'address', 'China')`可以触发视图, 实现的关键在于childOb。`childOb.dep.depend`会收集依赖，在Vue.set内部会执行childOb.dep的依赖。

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

**这里ob就是childOb, 通过dep.notify执行依赖，触发视图更新**

这里有个注意点：`Vue.set(vm.person, 'address', 'China')`触发的依赖是person字段收集的，并不是age字段。因为childOb.dep.depend是在触发person的get过程中执行的。但在这里并不影响视图更新，
因为Vue在解析`{person.address}`模板时，会同时触发person的get和address的get, person收集了依赖。address由于没有拦截set、get并没有收集依赖。

#### 数组observe处理

4、5、6都是对数组的操作, 在此之前我们了解Vue是如何对数组进行响应式处理的。

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
protoAugment和copyAugment两个方法目的是一致的,都是在value数组上添加`arrayMethods`对象上的一系列数组方法，从而当使用一些数组方法时能够具备响应式。

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

重写除了会执行原生的数组方法外，最关键的是会执行ob.dep.notify来通知观察者。对于`Vue.set(vm.list, 0, 22)`而言,ob就是vm.list.__ob__,也等于list字段的在`defineReactive$$1`闭包内定义的childOb。

这里需要注意的点是对于数组新增元素时的处理，对于新增的子元素（inserted）需要执行`observeArray(inserted)`让其observe化。

Vue.set中数组部分的简化代码如下：

```js
// 简化代码
Vue.$set = function(target,key,val){
    // 数组响应式处理:
    // 通过splice修改元素，由于splice方法已经被vue拦截,会通过target.__ob__.dep.notify执行依赖
    target.splice(key, 1, val);
    return val
}
```

Vue.set对于数组的处理很简单，通过触发splice修改对应元素。splice方法是定义在arrayMethods上的，内部会触发target.__ob__.dep.notify执行依赖。

接下来看数组的操作结果：

```js
// 数组
vm.list[0] = 22; // 4.不会触发视图更新
vm.list.splice(2, 1, 22) //5.可以触发视图更新
Vue.set(vm.list, 0, 22)  //6.可以触发视图更新
```

* 第4点 由于数组的索引不具备响应式，不能像对象属性那样通过`Object.defineProperty`进行拦截。所以`this.list[2]=22`并不会更新视图。
* 5、6操作最终都会调用被vue重写后的splice方法，通过执行`vm.list.__ob__.dep.notify()`来执行依赖触发视图更新。vm.list.__ob__就对应list字段闭包内的childOb

在`Object.defineProperty` 中存在以下代码

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

dependArray的作用时会遍历数组value, 并调用每个子元素dep.depend来收集依赖，收集到的依赖其实时属于value字段的。

为什么数组子元素需要收集和数组本身相同的依赖呢? 因为数组的索引不具备响应式,看如下示例：

```js
vm.$watch('list', {
    deep: true,
    handler() {
        console.log('trigger watch');
    }
})

Vue.set(vm.list[3], 'name', "Bob")  // trigger watch
```

如果没有dependArray,将不会输出"trigger watch"，因为子元素不会收集到这个Watcher。虽然我们观察的是list数组，但是数组子元素的改变也等价于数组本身发生了改变。所以数组自身的依赖，也需要通过dependArray递归让所有子元素收集依赖。
