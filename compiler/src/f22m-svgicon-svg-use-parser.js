const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');


// 前提： 字符串格式正确，且为单一根节点
bus.on('解析生成AST节点', function(){

    return function(text){
        let plugins = bus.on('解析生成AST节点插件');
        let rs = postobject(plugins).process({text});

        return rs.result;
    };

}());


// ------------------------------------------------------
// 字符串解析生成AST节点
// 
// 以下插件顺序相关，不可轻易变动
// 
// ------------------------------------------------------
bus.on('解析生成AST节点插件', function(){
    
    return postobject.plugin('gennode-plugin-01', function(root, context){

        root.walk( (node, object) => {

            let text = object.text;
            context.input = {text};

            // 像[view]一样解析为Token
            let tokenParser = bus.at('视图TOKEN解析器', text, text, text, 0);
            let type = 'Node';
            let nodes = tokenParser.parse();
            let objToken = {type, nodes};
            let newNode = this.createNode(objToken);

            node.replaceWith(...newNode.nodes);     // 转换为Token节点树
        });

    });
}());

bus.on('解析生成AST节点插件', function(){
    
    return postobject.plugin('gennode-plugin-02', function(root, context){

        // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
        const OPTS = bus.at('视图编译选项');
        root.walk( OPTS.TypeAttributeName, (node, object) => {
            if ( !node.parent ) return;

            let eqNode = node.after();
            if ( eqNode && eqNode.type === OPTS.TypeEqual ) {
                // 键=值的三个节点
                let valNode = eqNode.after();
                let Name = {pos: object.pos};
                let Value = {pos: valNode.object.pos};
                let pos = {start: object.pos.start, end: valNode.object.pos.end };

                let oAttr = {type: 'Attribute', name: object.value, value: valNode.object.value, Name, Value, isExpression: bus.at('是否表达式', valNode.object.value), pos};
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
                eqNode.remove();
                valNode.remove();

            } else {
                // 单一键节点（应该没有...）
                let oAttr = {type: 'Attribute', name: object.value, value: true, isExpression: false, pos: context.input.pos}
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
            }
        });

    });
}());

bus.on('解析生成AST节点插件', function(){
    
    return postobject.plugin('gennode-plugin-03', function(root){

        // 多个属性节点合并为一个标签属性节点
        root.walk( 'Attribute', (node) => {
            if ( !node.parent ) return;

            let ary = [node];
            let nextNode = node.after();
            while ( nextNode && nextNode.type === 'Attribute' ) {
                ary.push(nextNode);
                nextNode = nextNode.after();
            }

            let attrsNode = this.createNode({type:'Attributes'});
            node.before(attrsNode);
            ary.forEach(n => {
                attrsNode.addChild(n.clone());
                n.remove();
            });

        });

    });
}());

bus.on('解析生成AST节点插件', function(){
    
    // 自关闭标签统一转换为Tag类型节点
    return postobject.plugin('gennode-plugin-04', function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeTagSelfClose, (node, object) => {
            if ( !node.parent ) return;

            let type = 'Tag';
            let value = object.value;
            let pos = context.input.pos;
            let tagNode = this.createNode({type, value, pos})

            let tagAttrsNode = node.after();
            if ( tagAttrsNode && tagAttrsNode.type === 'Attributes' ) {
                tagNode.addChild(tagAttrsNode.clone());
                tagAttrsNode.remove();
            }

            node.replaceWith(tagNode);
        });

    });

}());

bus.on('解析生成AST节点插件', function(){
    
    // 开闭标签统一转换为Tag类型节点
    return postobject.plugin('gennode-plugin-05', function(root, context){

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
                throw new Err('missing close tag', { text: context.input.text, start: tagNode.object.pos.start });
            }

            if ( nextNode.type === OPTS.TypeTagClose ) {
                if ( nodeTagOpen.object.value !== nextNode.object.value ) {
                    throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, { text: context.input.text, ...tagNode.object.pos });
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



bus.on('解析生成AST节点插件', function(){
    
    // 最后一步，保存解析结果
    return postobject.plugin('gennode-plugin-99', function(root, context){
        context.result = root.nodes[0];
    });

}());
