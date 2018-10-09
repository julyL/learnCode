## 状态模式
>允许一个对象在其内部状态改变时改变它的行为，对象看起来似乎修改了它的类。

#### 示例
假设有一个light，初始状态为off，每次点击按钮可以切换light的状态： 【off -> weakLight -> strongLight -> off -> ...  】
light各个状态下所做的事就是简单的输出一下log，下面是4种实现

1-1.js 将所有的按钮切换逻辑都写在了 buttonWasPressed 中，是违反开放封闭原则的，之后如果需要修改逻辑或者新增light的状态都只能直接改buttonWasPressed中的代码，难以测试和维护

1-2.js 将所有的light状态都定义成了类，每个按钮切换的逻辑委托给了各个状态类中定义的buttonWasPressed方法去处理。分离了各个状态的处理逻辑，便于测试和维护

1-3.js 使用easy-fsm库声明一个**有限状态机**，事先定义好了light所有可能的状态和各个状态所能够切换到的状态。按钮切换需要处理的逻辑直接写在各个onState事件中即可

1-4.js  原生js实现一个简单的有限状态机


#### 状态模式的使用场景
1. 一个由一个或多个动态变化的属性导致发生不同行为的对象，在与外部事件产生互动时，其内部状态就会改变，从而使得系统的行为也随之发生变化，那么这个对象，就是有状态的对象

2. 代码中包含大量与对象状态有关的条件语句，像是if else或switch case语句，且这些条件执行与否依赖于该对象的状态。

#### 参考好文

[前端状态管理请三思](https://juejin.im/post/59fd94475188254115703461)

[JavaScript状态模式及状态机模型](https://mp.weixin.qq.com/s?__biz=MzU0OTExNzYwNg==&mid=2247484240&idx=1&sn=fd5ef3e916fe5ac99141c4cc641311ea&chksm=fbb58899ccc2018f331a8bc2ecc87f75c23184f1397ed6490917b1265d4d2380b10c1dc8aa94#rd)

#### 状态机的相关实现

[easy-fsm](https://github.com/oldj/easy-fsm)

[Javascript Finite State Machine](https://github.com/jakesgordon/javascript-state-machine)
