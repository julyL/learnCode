import { createLocation } from './LocationUtils.js';
import {
  addLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils.js';
import createTransitionManager from './createTransitionManager.js';
import {
  canUseDOM,
  getConfirmation,
  supportsHistory,
  supportsPopStateOnHashChange,
  isExtraneousPopstateEvent
} from './DOMUtils.js';
import invariant from './invariant.js';
import warning from './warning.js';

const PopStateEvent = 'popstate';
const HashChangeEvent = 'hashchange';

function getHistoryState() {
  try {
    return window.history.state || {};
  } catch (e) {
    // IE 11 sometimes throws when accessing window.history.state
    // See https://github.com/ReactTraining/history/pull/289
    return {};
  }
}

/**
 * Creates a history object that uses the HTML5 history API including
 * pushState, replaceState, and the popstate event.
 */
function createBrowserHistory(props = {}) {
  invariant(canUseDOM, 'Browser history needs a DOM');

  const globalHistory = window.history;
  const canUseHistory = supportsHistory();
  const needsHashChangeListener = !supportsPopStateOnHashChange();

  // 设置默认参数
  // forceRefresh: url改变时是否刷新页面。为true时,当url改变之后会调用window.location.href跳转到改变后的url
  // getUserConfirmation: 当用户离开当前的url时,提示用户是否需要离开。可以自定义拦截弹窗,默认采用window.comfirm
  const {
    forceRefresh = false,
    getUserConfirmation = getConfirmation,
    keyLength = 6
  } = props;

  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';

  // 根据state和当前路由状态生成location对象 
  function getDOMLocation(historyState) {
    const { key, state } = historyState || {};
    const { pathname, search, hash } = window.location;

    let path = pathname + search + hash;

    warning(
      !basename || hasBasename(path, basename),
      'You are attempting to use a basename on a page whose URL path does not begin ' +
      'with the basename. Expected path "' +
      path +
      '" to begin with "' +
      basename +
      '".'
    );

    if (basename) path = stripBasename(path, basename);

    return createLocation(path, state, key);
  }

  // 生成唯一的key(感觉有几率重复?)
  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  const transitionManager = createTransitionManager();

  // 每次改变url时,都会调用此方法来更新history的state({action,location})和length属性,并且触发listen绑定的事件
  function setState(nextState) {
    Object.assign(history, nextState);
    history.length = globalHistory.length;
    transitionManager.notifyListeners(history.location, history.action);
  }

  // popState事件触发时的回调
  function handlePopState(event) {
    // Ignore extraneous popstate events in WebKit.
    if (isExtraneousPopstateEvent(event)) return;
    handlePop(getDOMLocation(event.state));
  }

  // hashChange事件触发时的回调
  function handleHashChange() {
    handlePop(getDOMLocation(getHistoryState()));
  }

  let forceNextPop = false;

  // popState事件的处理
  function handlePop(location) {
    // 只有执行revertPop时,forceNextPop才为true,此时不需要再执行confirmTransitionTo方法向用户确认是否更改
    if (forceNextPop) {
      forceNextPop = false;
      setState();
    } else {
      const action = 'POP';

      // 路由变更时拦截并提醒用户,只有用户同意之后才能改变路由(相当于询问用户是否离开当前页)
      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          if (ok) {
            // ok为true,表示可以执行更改url的操作。
            setState({ action, location });
          } else {
            // false表示向用户咨询之后,用户拒绝离开当前url,此时需要撤销已执行的url变更操作
            revertPop(location);
          }
        }
      );
    }
  }

  // 用于回退history到上一个状态
  // 如：调用go方法(-1)  =>  会触发popState事件 =>  如果设置block方法,会询问用户是否离开当前url =>  如果用户拒绝离开当前url,但此时url已经被改变,将url回到上一个状态 => 执行revertPop,内部会执行go(1)来抵消go(-1)  =>  go(-1)操作也会触发popState事件,但标记forceNextPop会跳过block方法
  function revertPop(fromLocation) {
    const toLocation = history.location;

    // TODO: We could probably make this more reliable by
    // keeping a list of keys we've seen in sessionStorage.
    // Instead, we just default to 0 for keys we don't know.

    let toIndex = allKeys.indexOf(toLocation.key);

    if (toIndex === -1) toIndex = 0;

    let fromIndex = allKeys.indexOf(fromLocation.key);

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex;

    if (delta) {
      // 标记撤销操作
      forceNextPop = true;
      // 执行一个新的操作来抵消上一次被用户拒绝的操作,从而达到撤销的效果。
      go(delta);
    }
  }

  const initialLocation = getDOMLocation(getHistoryState());
  let allKeys = [initialLocation.key];
  // allKeys中的每个key都对应一条历史记录,allKeys相当于映射一个history历史栈 
  // 主要用于revertPop方法中计算delta的值

  // location对象转换为href
  function createHref(location) {
    return basename + createPath(location);
  }

  function push(path, state) {
    // 不支持 push({state},state),state只支持在第一个地方传参
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to push when the 1st ' +
      'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        // 询问用户之后,用户拒绝路由更改则直接返回
        if (!ok) return;

        // location对象转换为href
        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          // 调用原生pushState改变url
          globalHistory.pushState({ key, state }, null, href);

          if (forceRefresh) {
            // 设置forceRefresh时进行跳转
            window.location.href = href;
          } else {
            // history历史栈在回退之后,再进行push 会将当前位置之后的历史清除 
            // 如历史栈为 ['a','b','c','d'] 当前位置是'b', 当执行push('e')后 历史栈变为['a','b','e']
            const prevIndex = allKeys.indexOf(history.location.key);
            const nextKeys = allKeys.slice(0, prevIndex + 1);
            nextKeys.push(location.key);
            allKeys = nextKeys;

            setState({ action, location });
          }
        } else {
          warning(
            state === undefined,
            'Browser history cannot push state in browsers that do not support HTML5 history'
          );

          window.location.href = href;
        }
      }
    );
  }

  function replace(path, state) {
    warning(
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to replace when the 1st ' +
      'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          // 替换历史记录
          globalHistory.replaceState({ key, state }, null, href);

          if (forceRefresh) {
            window.location.replace(href);
          } else {
            // 替换指定位置的key
            const prevIndex = allKeys.indexOf(history.location.key);
            if (prevIndex !== -1) allKeys[prevIndex] = location.key;

            setState({ action, location });
          }
        } else {
          warning(
            state === undefined,
            'Browser history cannot replace state in browsers that do not support HTML5 history'
          );

          window.location.replace(href);
        }
      }
    );
  }

  function go(n) {
    globalHistory.go(n);
  }

  function goBack() {
    go(-1);
  }

  function goForward() {
    go(1);
  }

  let listenerCount = 0;

  // delta用于控制事件绑定和解绑的时机,防止多次绑定事件,并且在不需要进行listen和block时，进行事件解绑释放内存。
  // 注: 原生的history.pushState, history.replaceState等方法可以改变当前的url,但是并不会触发popstate事件。只有当触发go、forward、浏览器的前进、后退等时才会触发popstate事件。
  function checkDOMListeners(delta) {
    listenerCount += delta;

    // 绑定事件
    if (listenerCount === 1 && delta === 1) {
      window.addEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) {
      // 解绑事件
      window.removeEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener)
        window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

  let isBlocked = false;  // 是否绑定路由变化的监听事件

  function block(prompt = false) {
    // setPrompt方法会设置路由变更时的用户提醒, unblock用于取消提醒设置
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) {
      // 如果没有绑定路由变化监听事件,则绑定
      checkDOMListeners(1);
      isBlocked = true;
    }

    // 返回值用于取消提醒设置
    return () => {
      if (isBlocked) {
        isBlocked = false;
        checkDOMListeners(-1);
      }

      return unblock();
    };
  }

  function listen(listener) {
    const unlisten = transitionManager.appendListener(listener);
    // 绑定真实的dom事件(第一次listen时,会通过window.addEventListener绑定事件)
    checkDOMListeners(1);

    return () => {
      // 解绑dom事件
      checkDOMListeners(-1);
      // 从listeners队列中删除listener事件
      unlisten();
    };
  }

  const history = {
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

  return history;
}

export default createBrowserHistory;
