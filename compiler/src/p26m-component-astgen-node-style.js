const bus = require('@gotoeasy/bus');

bus.on('astgen-node-style', function(){

    // 标签样式属性生成json属性值形式代码
    // "size:12px;color:{color};height:100;" => ("size:12px;color:" + (color) + ";height:100;")
    // @show在前面已转换为display一起合并进style
    return function (tagNode){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let styleNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Style' ) {
                styleNode = nd;
                break;  // 找到
            }
        }


        if ( !styleNode || !styleNode.object.value ) return '';             // 没有样式节点或没有样式属性值，返回空白

        // 生成
        if ( !styleNode.object.isExpression ) {
            return '"' + lineString(styleNode.object.value) + '"';
        }

        let ary = [];
        parseExpression(ary, styleNode.object.value);
        return '(' + ary.join(' + ') + ')';
    }

}());


function parseExpression(ary, val){

    // 表达式中含对象
    if ( /^\{\s*\{[\s\S]*?\}\s*\}$/.test(val) ) {
        // TODO 待改善
        ary.push( val.replace(/^\{/, '').replace(/\}$/, '') );              // { {a: 123} } => {a:123}
        return;
    }


    let idxStart = val.indexOf('{');
    if ( idxStart < 0 ) {
        ary.push('"' + lineString(val) + '"');  // 无表达式
        return;
    }

    let idxEnd = val.indexOf('}', idxStart);
    if ( idxEnd < 0 ) {
        ary.push('"' + lineString(val) + '"');  // 无表达式
        return;
    }


    // TODO "size:12px;color:{`${color?color:'red'}`};height:100;" => ("size:12px;color:" + `${color?color:'red'}` + ";height:100;")

    if ( idxStart > 0 ) {
        ary.push('"' + lineString(val.substring(0, idxStart)) + '"');       // acb{def}ghi => "abc"
    }
    ary.push( '(' + val.substring(idxStart+1, idxEnd) + ')' );              // acb{def}ghi => (def)

    let tmp = val.substring(idxEnd + 1);
    tmp && parseExpression(ary, tmp);                                       // acb{def}ghi : ghi
}


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}
