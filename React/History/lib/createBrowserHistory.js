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
  const {
    // url改变时是否刷新页面，为true时改变url之后都会调用window.location.href来跳转到改变后的url
    forceRefresh = false,
    // 用于提示用户是否可以变更url,可以进行自定义弹窗,默认采用window.comfirm
    getUserConfirmation = getConfirmation,
    keyLength = 6
  } = props;
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : '';

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

  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  const transitionManager = createTransitionManager();

  // 每次改变url时都需要调用此方法
  function setState(nextState) {
    // 更新history对象的state和lenth属性
    Object.assign(history, nextState);
    history.length = globalHistory.length;
    // 触发通过history.listen绑定的事件
    transitionManager.notifyListeners(history.location, history.action);
  }

  function handlePopState(event) {
    // Ignore extraneous popstate events in WebKit.
    if (isExtraneousPopstateEvent(event)) return;
    handlePop(getDOMLocation(event.state));
  }

  function handleHashChange() {
    handlePop(getDOMLocation(getHistoryState()));
  }

  let forceNextPop = false;

  // popState事件的处理
  function handlePop(location) {
    // 只有执行revertPop时,forceNextPop为true，用于流程控制
    if (forceNextPop) {
      forceNextPop = false;
      setState();
    } else {
      const action = 'POP';

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

  // 通过执行一个新的action来反向抵消 已执行但被用户拒绝的action,从而达到撤销效果
  // 如：调用了go(-1) go方法不同于push和replace会先向用户确认,而是直接调用原生的history.go   =>   触发popState事件 =>    询问用户之后被拒绝 =>  执行revertPop,内部会执行go(1)来抵消go(-1)  =>  抵消的操作也会触发popState事件,通过标记forceNextPop跳过后续流程
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
  // allKeys相当于一个历史栈,每个key都对应一条历史记录 

  // Public interface
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
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          globalHistory.pushState({ key, state }, null, href);

          if (forceRefresh) {
            window.location.href = href;
          } else {
            // action为push, 会清除历史栈中当前历史记录之后的其他记录清除，新加上push的这条历史记录
            // 如历史栈为 ['a','b','c','d'] 当前url为'b', 当执行push('e')后 历史栈变为['a','b','e']
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
          globalHistory.replaceState({ key, state }, null, href);

          if (forceRefresh) {
            window.location.replace(href);
          } else {
            // action为replace, 直接替换指定位置(prevIndex)的key
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

  // 用于控制dom事件的 绑定和解绑
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

  let isBlocked = false;  // 防止checkDOMListeners多次调用

  function block(prompt = false) {
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) {
      checkDOMListeners(1);
      isBlocked = true;
    }

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
