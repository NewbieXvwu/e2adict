// src/modules/utils.js

/**
 * 一个防抖动函数，该函数会从上一次被调用后，延迟 `delay` 毫秒后调用 `func` 方法。
 * @param {Function} func 要防抖动的函数。
 * @param {number} delay 延迟的毫秒数。
 * @returns {Function} 返回一个新的（防抖动）函数。
 */
export function debounce(func, delay) {
  let timeoutId;

  return function(...args) {
    // 清除之前的定时器，以重置延迟
    clearTimeout(timeoutId);

    // 设置一个新的定时器
    timeoutId = setTimeout(() => {
      // 在延迟结束后，用正确的上下文和参数调用原始函数
      func.apply(this, args);
    }, delay);
  };
}
