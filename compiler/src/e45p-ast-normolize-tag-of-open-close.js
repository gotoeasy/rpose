const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 开闭标签统一转换为Tag类型节点
    return postobject.plugin(/**/__filename/**/, function(root, context){

        const OPTS = bus.at('视图编译选项');

        let normolizeTagNode = (tagNode, nodeTagOpen) => {

            let nextNode = nodeTagOpen.after();
            while ( nextNode && nextNode.type !== OPTS.TypeTagClose ) {

                if ( nextNode.type === OPTS.TypeTagOpen ) {
                    let type = 'Tag';
                    let value = nextNode.object.value;
                    let pos = nextNode.object.pos;
                    let subTagNode = this.createNode({type, value, pos});
                    normolizeTagNode(subTagNode, nextNode);

                    tagNode.addChild( subTagNode );
                }else{
                    tagNode.addChild( nextNode.clone() );
                }

                nextNode.remove();
                nextNode = nodeTagOpen.after();
            }

            if ( !nextNode ) {
                throw new Err('missing close tag', { ...context.input, start: tagNode.object.pos.start });
            }

            if ( nextNode.type === OPTS.TypeTagClose ) {
                if ( nodeTagOpen.object.value !== nextNode.object.value ) {
                    throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, { ...context.input, ...tagNode.object.pos });
                }
                tagNode.object.pos.end = nextNode.object.pos.end;
                nextNode.remove();
                return tagNode;
            }

            // 漏考虑的特殊情况
            throw new Error('todo unhandle type');

        }


        root.walk( OPTS.TypeTagOpen, (node, object) => {
            if ( !node.parent ) return;

            let type = 'Tag';
            let value = object.value;
            let pos = object.pos;
            let tagNode = this.createNode({type, value, pos});
            normolizeTagNode(tagNode, node);

            node.replaceWith(tagNode);
        });

    });

}());

