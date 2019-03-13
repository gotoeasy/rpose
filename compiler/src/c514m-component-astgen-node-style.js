const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-node-style', function(){

    // 标签样式属性生成json属性值形式代码
    // "size:12px;color:{color};height:100;" => ("size:12px;color:" + (color) + ";height:100;")
    return function (tagNode, context){
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
        let ary = [];
        parseExpression(ary, styleNode.object.value);
        return '(' + ary.join(' + ') + ')';
    }

}());

function parseExpression(ary, val){

    
    let idx1 = val.indexOf('{');
    let idx2 = val.indexOf('{=');
    if ( idx1 < 0 && idx2 < 0 ) {
        ary.push('"' + lineString(val) + '"');  // 无表达式
        return;
    }

    let idxEnd, tmp;
    if ( idx1 >= 0 &&  idx2 >= 0 ) {
        if ( idx1 === idx2 ) {
            idx1 = -1;                          // { 无效
        }else if ( idx1 < idx2 ) {
            idx2 = -1;                          // {= 无效
        }else if ( idx2 < idx1 ) {
            idx1 = -1;                          // { 无效
        }
    }


    if ( idx1 >= 0 ) {
        idxEnd = val.indexOf('}');

        if ( idxEnd <= idx1 ) {
            ary.push('"' + lineString(val) + '"');                      // 无表达式
            return;
        }
        
        if ( /^\{\=?\s*\{\=?.*\}\s*\}$/.test(val) ) {
            // TODO 临时补丁，待改善
            ary.push(getExpression(val));                               // {{a:123}} : {a:123}
            return;
        }

        tmp = val.substring(idx1, idxEnd + 1);
        if ( idx1 > 0 ) {
            ary.push('"' + lineString(val.substring(0, idx1)) + '"');   // acb{=def}ghi : abc
        }
        ary.push(getExpression(tmp));                                   // acb{=def}ghi : {=def}

        tmp = val.substring(idxEnd + 1);
        tmp.trim() && parseExpression(ary, tmp);                        // acb{=def}ghi : ghi
        return;
    }
    
    if ( idx2 >= 0 ) {
        idxEnd = val.indexOf('}');
        if ( idxEnd <= idx2 ) {
            ary.push('"' + lineString(val) + '"');                      // 无表达式
            return;
        }
        
        tmp = val.substring(idx2, idxEnd + 1);
        if ( idx2 > 0 ) {
            ary.push('"' + lineString(val.substring(0, idx2)) + '"');   // acb{def}ghi : abc
        }
        ary.push(getExpression(tmp));                                   // acb{def}ghi : {def}

        tmp = val.substring(idxEnd + 1);
        tmp.trim() && parseExpression(ary, tmp);                        // acb{def}ghi : ghi
    }

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

// 取表达式代码（删除两边表达式符号）
function getExpression(expr){
    let val = (expr + '').trim();
    // 长的先匹配
    if ( val.startsWith('{=') && val.endsWith('}') ) {
        return '(' + val.substring(2, val.length - 1) + ')';
    }else if ( val.startsWith('{') && val.endsWith('}') ) {
        return '(' + val.substring(1, val.length - 1) + ')';
    }
    return '"' + lineString(val) + '"';
}
