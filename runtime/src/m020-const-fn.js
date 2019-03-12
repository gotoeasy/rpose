// ---------------------------
// 常用的一句话方法
// ---------------------------

const defer = (fn, ...args) => Promise.resolve(...args).then( fn );

const log = (...args) => console.log(...args);
const warn = (...args) => console.warn(...args);
const error = (...args) => console.error(...args);

const _toString = obj => Object.prototype.toString.call(obj);
const isFunction = obj => (typeof obj == 'function') && obj.constructor == Function;
const isBoolean = str => typeof str === 'boolean';
const isNumber = str => typeof str === 'number';
const isString = str => typeof str === 'string';
const isObject = obj => obj !== null && typeof str === 'object';
const isArray = obj => Array.isArray(obj) || obj instanceof Array;
const isPlainObject = obj => _toString(obj) === '[object Object]';
const isDate = obj => _toString(obj) === '[object Date]';
const isRegExp = obj => _toString(obj) === '[object RegExp]';
const isMap = obj => _toString(obj) === '[object Map]';
const isSet = obj => _toString(obj) === '[object Set]';
const isTextNode = obj => _toString(obj) === '[object Text]'; // TextNode

const toLowerCase = str => str.toLowerCase();
