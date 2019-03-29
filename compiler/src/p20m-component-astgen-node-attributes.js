const bus = require('@gotoeasy/bus');

const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

bus.on('astgen-node-attributes', function(){

    // 标签普通属性生成json形式代码
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查属性节点
        let attrsNode;
        for ( let i=0, nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Attributes' ) {
                attrsNode = nd;
                break;
            }
        }
        if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return '';

        // 生成
        let key, value, comma = '', ary = [];
        ary.push( `{ `);     
        attrsNode.nodes.forEach(node => {
            key = '"' + lineString(node.object.name) + '"';
            if ( node.object.isExpression ) {
                value = bus.at('表达式代码转换', node.object.value);
            }else if (typeof node.object.value === 'string'){

                if ( !tagNode.object.standard && REG_EVENTS.test(node.object.name) && !node.object.isExpression && context.script.$actionkeys ) {
                    // 这是个组件上的事件名属性（非组件的事件名属性都转成Event了），如果不是表达式，而且在actions中有定义，顺便就办了，免得一定要写成表达式
                    let val = node.object.value.trim();
                    let fnNm = val.startsWith('$actions.') ? val.substring(9) : val;
                    if ( context.script.$actionkeys.includes(fnNm) ) {
                        // 能找到定义的方法则当方法处理
                        value = `$actions['${fnNm}']`;                    // "fnClick" => $actions['fnClick']
                    }else{
                        // 找不到时，按普通属性处理
                        value = '"' + lineString(node.object.value) + '"';
                    }

                }else{
                    value = '"' + lineString(node.object.value) + '"';
                }
            }else{
                value = node.object.value;
            }

            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
//    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}

