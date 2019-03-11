const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){


        let normolizeTagNode = (tagNode, nodeTagOpen) => {

            let nextNode = nodeTagOpen.after();
            while ( nextNode && nextNode.type !== 'TagClose' ) {

                if ( nextNode.type === 'TagOpen' ) {
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


            if ( nextNode.type === 'TagClose' ) {
                if ( nodeTagOpen.object.text !== nextNode.object.text ) {
                    throw new Err('unmatch close tag', 'file=' + context.input.file, {text: context.input.text, start: tagNode.object.loc.start.pos, end: nextNode.object.loc.end.pos});
                }
                tagNode.object.loc.end = nextNode.object.loc.end;
                nextNode.remove();
                return tagNode;
            }

            // 漏考虑的特殊情况
            throw new Error('todo unhandle type');

        }


        root.walk( 'TagOpen', (node, object) => {
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

