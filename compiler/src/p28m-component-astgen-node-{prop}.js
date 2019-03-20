const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-node-{prop}', function(){

    // 标签对象表达式属性生成对象复制语句代码片段
    // 如 {prop1} {prop2}，最终rpose.assign( {attrs属性对象}, prop1, prop2)
    // 生成： (prop1), (prop2)
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let exprAttrNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'ObjectExpressionAttributes' ) {
                exprAttrNode = nd;
                break;  // 找到
            }
        }
        if ( !exprAttrNode || !exprAttrNode.nodes || !exprAttrNode.nodes.length ) return '';

        // 生成
        let prop, ary = [];
        exprAttrNode.nodes.forEach(node => {
            prop = node.object.name.replace(/^\s*\{=?/, '(').replace(/\}\s*$/, ')');          // {prop} => prop, {=prop} => prop
            ary.push(prop);
        });
        
        return ary.join(',');
    }

}());

