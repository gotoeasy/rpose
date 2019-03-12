const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-of-events-node', function(){

    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let eventsNode;
        for ( let i=0; eventsNode=tagNode.nodes[i++]; ) {
            if ( eventsNode.type === 'Events' ) {
                break;  // 找到
            }
        }
        if ( !eventsNode || !eventsNode.nodes || !eventsNode.nodes.length ) return '';

        // 生成
        let key, value, comma = '', ary = [];
        ary.push( `{ `);     
        eventsNode.nodes.forEach(node => {
            key = node.object.name.substring(2);                            // onclick => click
            value = node.object.value.trim();
            if ( /^\s*\{=/.test(value) ) {
                value = value.substring(2, value.length-1).trim();          // {= abcd } => abcd
            }else if ( /^\s*\{/.test(value) ) {
                value = value.substring(1, value.length-1).trim();          // { abcd } => abcd
            }

            if ( context.script.$actionkeys && context.script.$actionkeys.includes(value) ) {
                value = '($actions.' + value + ')';                     // {= abcd } => ($actions.value)
            }else{
                // 指定方法找不到
                throw new Err('action not found: ' + value, {file: context.input.file, text: context.input.text, start: node.object.loc.start.pos, end: node.object.loc.end.pos});
            }
            
            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());

