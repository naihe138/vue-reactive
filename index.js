// 判断是否是obj类型
const isObject = val => val !== null && typeof val === 'object'
const toProxy = new WeakMap()
const toRaw = new WeakMap()
// 存储effect
const targetMap = new WeakMap()

const handlers = {
  get (target, key, receiver) {
    const res = Reflect.get(target, key, receiver)
    // effect 收集
    track(target, key)
    return isObject(res) ? reactive(res) : res
  },
  set (target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver)
    const extraInfo = { oldValue: target[key], newValue: value }
    trigger(target, key, extraInfo)
    return result
  },
  deleteProperty () {
    return Reflect.deleteProperty(target, key)
  }
}

// effect 的触发
function trigger(target, key, extraInfo) {
  const depsMap = targetMap.get(target)
  // 没有被订阅到
  if (depsMap === void 0) {
    return;
  }
  const effects = new Set()
  const computedRunners = new Set()
  if (key !== void 0) {
    let deps = depsMap.get(key)
    deps.forEach(effect => {
      if (effect.computed) {
        computedRunners.add(effect)
      } else {
        effects.add(effect)
      }
    })
  }
  const run = effect => {
    effect()
  }
  computedRunners.forEach(run)
  effects.forEach(run)
}

// 跟踪订阅effect
function track (target, key) {
  const effect = activeEffectStack[activeEffectStack.length - 1]
  if (effect) {
    let depsMap = targetMap.get(target)
    if (depsMap === void 0) {
      depsMap = new Map()
      targetMap.set(target, depsMap)
    }
    let dep = depsMap.get(key)
    if (dep === void 0) {
      dep = new Set()
      depsMap.set(key, dep)
    }
    if (!dep.has(effect)) {
      // 收集当前的effect
      dep.add(effect)
      // effect 收集当前的dep
      effect.deps.push(dep)
    }
  }
}

function reactive (target) {
  let observed = toProxy.get(target)
  // 如果是缓存代理过的
  if (observed) {
    return observed
  }
  // 重复调用reactive
  if (toRaw.has(target)) {
    return target
  }
  observed = new Proxy(target, handlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

function effect (fn, options = {}) {
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

function createReactiveEffect(fn, options) {
  const effect = function effect(...args) {
    return run(effect, fn, args)
  }
  effect.lazy = options.lazy
  effect.computed = options.computed
  effect.deps = []
  return effect
}

const activeEffectStack = []
function run (effect, fn, args) {
  if (activeEffectStack.indexOf(effect) === -1) {
    try {
      activeEffectStack.push(effect)
      return fn(...args)
    }
    finally {
      activeEffectStack.pop()
    }
  }
}

function computed(fn) {
  const getter = fn
  const runner = effect(getter, { computed: true, lazy: true })
  return {
    effect: runner,
    get value() {
      value = runner()
      return value
    }
  }
}