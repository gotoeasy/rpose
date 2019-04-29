const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

const AryNm = 'v_Array';

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        let writer = context.writer;
        let script = context.script;

        root.walk( 'View', (node) => {

            if ( !node.nodes || node.nodes.length < 1 ) {
                return writer.write('// 没有节点，无可生成');
            }

            writer.write( 'function nodeTemplate($state, $options, $actions, $this) {' );
            if ( hasCodeBolck(node.nodes) ) {
                writer.write( `${ topNodesWithScriptJsify(node.nodes, context) }` );        // 含代码块子节点
            }else{
                writer.write( `${ topNodesWithoutScriptJsify(node.nodes, context) }` );     // 无代码块子节点
            }
            writer.write( '}' );

            // 视图的模板函数源码
            script.vnodeTemplate = writer.toString();

            return false;
        });

    });

}());


// 顶层点中含有代码块，通过数组在运行期取得标签对象
function topNodesWithScriptJsify(nodes=[], context){
    let ary = [], src;
    ary.push( ` let ${AryNm} = []; ` );
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ) {
            ary.push( node.object.value );                                  // 代码块，直接添加
        }else if ( src = bus.at('astgen-node-tag', node, context) ) {
            ary.push( ` ${AryNm}.push( ${src} ); ` );                       // 标签节点
        }else if ( src = bus.at('astgen-node-text', node, context) ) {
            ary.push( ` ${AryNm}.push( ${src} ); ` );                       // 文本节点
        }else{
            throw new Err('unhandle node type');                            // 应该没有这种情况
        }
    }
    ary.push(` ${AryNm}.length > 1 && console.warn("invlid tag count"); `);
    ary.push(` return ${AryNm}.length ? v_Array[0] : null; `);

    return ary.join('\n');
}

// 顶层点中没有代码块，返回标签对象
function topNodesWithoutScriptJsify(nodes=[], context){

    if ( nodes.length > 1 ) {
        let text = context.input.text;
        let file = context.input.file;
        let start = nodes[1].object.loc.start.pos;
        nodes[0].type !== 'Tag' && (start = nodes[0].object.loc.start.pos);
        throw new Err('invalid top tag', {text, file, start});              // 组件顶部只能有一个标签
    }

    let src, node = nodes[0];
    if ( node.type !== 'Tag' ) {
        let text = context.input.text;
        let file = context.input.file;
        let start = nodes[0].object.loc.start.pos;
        throw new Err('missing top tag', {text, file, start});              // 组件顶部只能有一个标签
    }

    src = bus.at('astgen-node-tag', node, context);
    if ( src ) return `return ${src}`;                                      // 标签节点 {...}

    src = bus.at('astgen-node-text', node, context);
    if ( src ) return `return ${src}`;                                      // 文本节点 {...}

    // 应该没有这种情况，万一有，多数是修改添加后漏对应
    throw new Err('unhandle node type');
}

function hasCodeBolck(nodes){
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'JsCode' ){
            return true;
        }
    }
    return false;
}
