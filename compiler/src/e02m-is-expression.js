const bus = require('@gotoeasy/bus');

bus.on('是否表达式', function (){

    const OPTS = bus.at('视图编译选项');

    return function(val){

        if ( !val ) return false;
    
        // TODO 使用常量
        let tmp = (val+'').replace(/\\\{/g, '').replace(/\\\}/g, '');
        return /\{.*\}/.test(tmp);
    }

}());
