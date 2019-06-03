const bus = require('@gotoeasy/bus');

bus.on('是否表达式', function (){

    return function(val){

        if ( !val ) return false;
    
        // TODO 使用常量
        let tmp = (val+'').replace(/\\\{/g, '').replace(/\\\}/g, '');

        // 如果用/^\{.*\}$/，可能会导致style判断出错，如style="color:{color}"
        return /\{.*\}/.test(tmp);
    }

}());
