import merge from "deepmerge";
import * as shvl from "shvl";

// vuex状态持久化
export default function (options, storage, key) {
    options = options || {};
    storage = options.storage || (window && window.localStorage);
    key = options.key || "vuex";

    // 测试storage的可用性
    function assertStorageDefaultFunction(storage) {
        storage.setItem("@@", 1);
        storage.removeItem("@@");
    }

    const assertStorage = shvl.get(
        options,
        "assertStorage",
        assertStorageDefaultFunction
    );

    assertStorage(storage);

    // 获取缓存的state
    function getState(key, storage, value) {
        try {
            return (value = storage.getItem(key)) && typeof value !== "undefined"
                ? JSON.parse(value)
                : undefined;
        } catch (err) { }

        return undefined;
    }

    function filter() {
        return true;
    }

    function setState(key, state, storage) {
        return storage.setItem(key, JSON.stringify(state));
    }

    function reducer(state, paths) {
        return paths.length === 0
            ? state
            : paths.reduce(function (substate, path) {
                return shvl.set(substate, path, shvl.get(state, path));
            }, {});
    }

    function subscriber(store) {
        return function (handler) {
            return store.subscribe(handler);
        };
    }

    const fetchSavedState = () => (options.getState || getState)(key, storage);

    let savedState;

    if (options.fetchBeforeUse) {
        savedState = fetchSavedState();
    }

    return function (store) {
        // fetchBeforeUse默认为false
        if (!options.fetchBeforeUse) {
            // 从storage中获取缓存state
            savedState = fetchSavedState();
        }

        if (typeof savedState === "object" && savedState !== null) {
            // overwirte为true，则直接用savedState替换根store的state
            // 否则合并savedState到根stored的state
            store.replaceState(
                options.overwrite
                    ? savedState
                    : merge(store.state, savedState, {
                        arrayMerge:
                            options.arrayMerger ||
                            function (store, saved) {
                                return saved;
                            },
                        clone: false
                    })
            );
            (options.rehydrated || function () { })(store);
        }
        // subscriber执行会返回一个函数handler，handler会在每个 mutation 完成后调用，接收mutation 和经过 mutation 后的状态作为参数
        (options.subscriber || subscriber)(store)(function (mutation, state) {
            // 对mutation进行过滤, 可以不存储一些操作导致的state变化
            if ((options.filter || filter)(mutation)) {
                // 对经过mutation后的state进行存储
                (options.setState || setState)(
                    key,
                    // 处理存储的值
                    (options.reducer || reducer)(state, options.paths || []),
                    storage
                );
            }
        });
    };
}