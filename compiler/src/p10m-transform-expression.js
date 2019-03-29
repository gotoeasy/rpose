const bus = require('@gotoeasy/bus');

bus.on('表达式代码转换', function(){

    return function (expression){
        let expr = expression.trim();
        expr.startsWith('{') && expr.endsWith('}') && (expr = expr.substring(1, expr.length-1));
        return `(${expr})`;
    }

}());
