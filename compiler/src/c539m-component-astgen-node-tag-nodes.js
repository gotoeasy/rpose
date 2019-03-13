const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

const AryName = '_Ary';

bus.on('astgen-node-tag-nodes', function(){
    return nodesJsify;
}());

function nodesJsify(nodes=[], context){
    if ( !nodes.length ) return '';

    return hasCodeBolck(nodes) ? nodesWithScriptJsify(nodes, context) : nodesWithoutScriptJsify(nodes, context);
}

// 节点数组中含有代码块，通过箭头函数返回动态数组
function nodesWithScriptJsify(nodes=[], context){
    let ary = [], src;
    ary.push( ` ((${AryName}) => { ` );

//    ary.push( ` let ${AryName} = []; ` );
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ) {
            ary.push( node.object.value );                                  // 代码块，直接添加
        }else if ( src = bus.at('astgen-node-tag', node, context) ) {
            ary.push( ` ${AryName}.push( ${src} ); ` );                     // 标签节点
        }else if ( src = bus.at('astgen-node-text', node, context) ) {
            ary.push( ` ${AryName}.push( ${src} ); ` );                     // 文本节点
        }else if ( node.type === 'Attributes' || node.type === 'Events' || node.type === 'ExpressionAttributes' ) {
            // ignore
        }else{
//console.info('-------------node------------', node)
            throw new Err('unhandle node type');                            // 应该没有这种情况
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
    return '[' + ary.join(',\n') + ']';     // [{...},{...},{...}]
}


function hasCodeBolck(nodes){
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ){
            return true;
        }
    }
    return false;
}
