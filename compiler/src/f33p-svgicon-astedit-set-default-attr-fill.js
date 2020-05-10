const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 添加默认属性 fill='currentColor'
    return postobject.plugin(/**/__filename/**/, function(root){

        root.walk( 'Tag', (node, object) => {
            if ( !/^svgicon$/i.test(object.value) ) return;

            // 查找Attributes，起码得有名称属性，不会找不到
            let attrsNode;
            if ( node.nodes ) {
                for ( let i=0,nd; nd=node.nodes[i++]; ) {
                    if ( nd.type === 'Attributes' ) {
                        attrsNode = nd;
                        break;
                    }
                }
            }
            if (!attrsNode) {
                attrsNode = this.createNode({type:'Attributes'});
                node.addChild(attrsNode);
            }

            // 查找是否存在指定属性，没有就默认加上
            let fill;
            for (let i=0,nd; nd=attrsNode.nodes[i++]; ) {
                if (/^fill$/i.test(nd.object.name)) {
                    fill = true;
                    break;
                }
            }
            if (!fill) {
                let oAttr = {type: 'Attribute', name: 'fill', value: 'currentColor', Name:{pos: object.pos}, Value:{pos: object.pos}, isExpression: false, pos:object.pos};
                attrsNode.addChild(this.createNode(oAttr));
            }


        });

    });

}());

