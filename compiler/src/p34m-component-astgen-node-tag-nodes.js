const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

const AryName = '_Ary';

bus.on('astgen-node-tag-nodes', function(){
    return nodesJsify;
}());

function nodesJsify(nodes=[], context){
    if ( !nodes.length ) return '';

    let keyCounter = context.keyCounter;    // 保存原节点标识值
    context.keyCounter = 1;                 // 重新设定节点标识（令其按在同一组子节点单位内递增）

    let rs = hasCodeBolck(nodes) ? nodesWithScriptJsify(nodes, context) : nodesWithoutScriptJsify(nodes, context);

    context.keyCounter = keyCounter;        // 还原节点标识值
    return rs;
}

// 节点数组中含有代码块，通过箭头函数返回动态数组
function nodesWithScriptJsify(nodes=[], context){
    let ary = [], src;

    ary.push( ` ((${AryName}) => { ` );

    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ) {
            ary.push( node.object.value );                                  // 代码块，直接添加
        }else if ( src = bus.at('astgen-node-tag', node, context) ) {
            ary.push( ` ${AryName}.push( ${src} ); ` );                     // 标签节点
        }else if ( src = bus.at('astgen-node-text', node, context) ) {
            ary.push( ` ${AryName}.push( ${src} ); ` );                     // 文本节点
        }else if ( node.type === 'Attributes' || node.type === 'Events' || node.type === 'ObjectExpressionAttributes' ) {
            // ignore
        }else if ( node.type === 'Class' || node.type === 'Style') {
            // ignore
        }else if ( node.type === '@key') {
            // ignore
        }else{
            throw new Err('unhandle node type: ' + node.type);              // 应该没有这种情况
        }
    }
    ary.push( ` return ${AryName}; `   );

    ary.push( ` })([]) ` );
    return ary.join('\n');
}


// 节点数组中含有代码块，返回静态数组
function nodesWithoutScriptJsify(nodes=[], context){
    let src, ary = [];
    nodes.forEach(node => {
        src = bus.at('astgen-node-tag', node, context);
        src && ary.push( src );

        src = bus.at('astgen-node-text', node, context);
        src && ary.push( src );
    })
    return ary.length ? ('[' + ary.join(',\n') + ']') : '';     // 空白或 [{...},{...},{...}]
}


function hasCodeBolck(nodes){
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ){
            return true;
        }
    }
    return false;
}
