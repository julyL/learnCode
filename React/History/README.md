## 1 概述

[history](https://github.com/ReactTraining/history#readme): react-router的核心依赖库, 用于路由的导航控制

### 2 用法

history库提供了3个方法:
1. `createBrowserHistory` 采用HTML5 History Api进行路由处理
2. `createHashHisotry`  采用hash模式
3. `createMemoryHistory`  适用于没有dom的环境如React Native

以`createBrowserHistory`为例进行讲解
```js
import { createBrowserHistory } from 'history';

var myHistory = createBrowserHistory();

var unlisten = myHistory.listen((location, action) => {
    console.log(action, location.pathname, location.state);
});

myHistory.push('/home', { some: 'state' });

unlisten();
```
上诉代码,我们创建了一个myHistory对象, 监听了url变化事件,然后将当前url导航到了/home(此时会触发监听的事件), 最后进行了事件解绑。 

执行createBrowserHistory得到一个myHistory对象,myHistory对象只是对原生window.history对象的封装，结构如下:
```js
  const myHistory = {
    length: globalHistory.length,
    action: 'POP',      
    location: initialLocation,   
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    block,
    listen
  };
```
length: window.history.length

action: 用于描述操作路由的行为,初始化时为'POP'。`push`方法对应为'PUSH'、`replace`方法对象'REPLACE'

location: 路由状态的描述对象,结果如下
```js
{
    pathname,
    search,
    hash,
    state,  // 执行push、replace传入的state对象
    key    // 每个历史记录对应一个唯一的key
}

```

`createHref`: 用于将location对象转换为url

`push`、`replace`、`go`、`goBack`、`goForward`: 用于路由导航,内部调用是原生history对象上的方法
1. `go`、`goBack`、`goForward`对应`history.go`
2. `createBrowserHistory`中`push`对应`history.pushState`,`replace`对应`history.replaceState`,
3. `createHashHistory`中`push`对应`window.location.hash`,`replace`对应`window.location.replace`

`listen`用于监听路由变化事件, 每当路由变化时都会触发回调,回调事件中的参数为`location`和`action`,分别表示当前路由的状态和操作路由的行为。 

**当需要实现单页应用时,可以在listen回调事件中编写视图更新的逻辑,以达到“页面切换”的效果。又比如单页应用中,用户访问的路径不存在时,前端需要重新“导航”到404页面**


`block`: 用于路由变更时,进行拦截提醒用户是否需要“离开当前页面”。默认采用window.confirm提醒用户,也可以通过向createBrowserHistory传getUserConfirmation参数设计自定义弹窗。如果用户拒绝,则路由不会发生变化。用法如下:
```js
myHistory.block('Are you sure you want to leave this page?');
// or
myHistory.block((location, action) => {
  if (input.value !== '') return 'Are you sure you want to leave this page?';
});
```

## 3 源码注释
仅对createBrowserHistory部分进行了注释, 见./lib/createBrowserHistory.js

一个单页应用示例见./demo/index.html,演示demo时需要在demo目录下执行`anywhere`启动一个静态服务器(anywhere为npm包,需全局安装)
