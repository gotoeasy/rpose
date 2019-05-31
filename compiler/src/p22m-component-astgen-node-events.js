const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-node-events', function(){

    // 标签事件属性生成json形式代码
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let eventsNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Events' ) {
                eventsNode = nd;
                break;  // 找到
            }
        }
        if ( !eventsNode || !eventsNode.nodes || !eventsNode.nodes.length ) return '';

        // 生成
        let key, value, comma = '', ary = [];
        ary.push( `{ `);     
        eventsNode.nodes.forEach(node => {
            key = node.object.name.substring(2);                                        // onclick => click
            value = node.object.value;
            if ( node.object.isExpression ) {
                value = bus.at('表达式代码转换', value);                                // { abcd } => (abcd)
            }else{
                // 静态定义时顺便检查
                value = value.trim();
                let match = value.match(/^this\s*\.(.+)$/) || value.match(/^this\s*\[\s*['"](.+)['"]\s*]/);
                let fnNm = match ? match[1] : value;                                    // this.fnClick => fnClick, this['fnClick'] => fnClick, fnClick => fnClick
                if ( context.script.Method[fnNm] ) {
                    value = 'this.' + fnNm;                                             // fnClick => this.fnClick
                }else{
                    // 指定方法找不到
                    let names = Object.keys(context.script.Method);
                    let msg = `event handle not found (${fnNm})${ names.length ? ('\n  etc. ' + names.join('/')) : '' }`;
                    throw new Err(msg, { ...context.input, ...node.object.Value.pos });
                }
            }
            
            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());

