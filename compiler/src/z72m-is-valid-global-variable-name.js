const bus = require('@gotoeasy/bus');

const oSetVarNames = new Set([
    '$$', 'rpose', '$SLOT',
    'require',
    'window', 'document', 'sessionStorage', 'localStorage', 'location', 'console', 'alert', 'escape', 'unescape',
    'clearInterval', 'setInterval', 'setTimeout', 'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'eval', 'decodeURI', 'encodeURI', 'toString', 'toLocaleString', 'valueOf', 'isPrototypeOf',
    'Function', 'arguments', 'JSON', 'Number', 'String',
    'Error', 'SyntaxError', 'TypeError', 'URIError', 'EvalError', 'RangeError', 'ReferenceError',
    'Array', 'Boolean', 'Math', 'Date', 'Object', 'RegExp', 'NaN', 'Symbol', 'Number',
    'assignOptions', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'WeakSet',
]);

bus.on('是否有效的全局变量名', function (){

    return function(name){
        return oSetVarNames.has(name);
    }

}());
