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
                    let loc = nextNode.object.loc;
                    let subTagNode = this.createNode({type, value, loc});
                    normolizeTagNode(subTagNode, nextNode);

                    tagNode.addChild( subTagNode );
                }else{
                    tagNode.addChild( nextNode.clone() );
                }

                nextNode.remove();
                nextNode = nodeTagOpen.after();
            }

            if ( !nextNode ) {
                throw new Err('missing close tag', 'file=' + context.input.file, {text: context.input.text, start: tagNode.object.loc.start.pos});
            }

            if ( nextNode.type === OPTS.TypeTagClose ) {
                if ( nodeTagOpen.object.value !== nextNode.object.value ) {
                    throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, 'file=' + context.input.file, {text: context.input.text, start: tagNode.object.loc.start.pos, end: nextNode.object.loc.end.pos});
                }
                tagNode.object.loc.end = nextNode.object.loc.end;
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
            let loc = object.loc;
            let tagNode = this.createNode({type, value, loc});
            normolizeTagNode(tagNode, node);

            node.replaceWith(tagNode);
        });

    });

}());

