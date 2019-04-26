const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');


bus.on('SVG图标文件解析', function(result={}){

    return function(file, attrs, loc){

        let plugins = bus.on('SVG图标文件解析插件');
        let rs = postobject(plugins).process({file, attrs, loc});

        return rs.result;
    };

}());


// ------------------------------------------------------
// 读取指定的svg图标文件，解析为view兼容的语法树结构
// svg图标文件来源为npm包时，自动判断安装
// 
// 以下插件顺序相关，不可轻易变动
// 
// ------------------------------------------------------
bus.on('SVG图标文件解析插件', function(){
    
    return postobject.plugin('svgicon-plugin-01', function(root, context){

        // 读取解析svg内容转换为Token节点树
        root.walk( (node, object) => {

            let file = object.file;
            let attrs = object.attrs;           // 自定义的svg属性
            let loc = object.loc;
            let text = File.read(object.file);

            // 不支持大于50K的svg图标文件
            if ( text.length > 50 * 1024 ) {
                throw new Error(`unsupport svg icon file (size>50K) [${file}]`);
            }
            // 不支持图标字体文件
            if ( text.indexOf('<font-face') > 0 ) {
                throw new Error(`unsupport webfonts svg file [${file}]`);
            }

            // <?xml version="1.0" encoding="utf-8"?>
            // 通常不该引用含xml声明头的原始xml文件，以防万一，简单删除之
            if ( /^<\?xml\s/i.test(text) ) {
                let idx = text.indexOf('?>');
                text = text.substring(idx+2);
            }

            context.input = {file, text, attrs, loc};

            // 像[view]一样解析为Token
            let tokenParser = bus.at('视图TOKEN解析器', text, text, file);
            let type = 'Svgicon';
            let nodes = tokenParser.parse();
            let objToken = {type, nodes};
            let newNode = this.createNode(objToken);

            node.replaceWith(...newNode.nodes);     // 转换为Token节点树
        });

    });
}());

bus.on('SVG图标文件解析插件', function(){
    
    return postobject.plugin('svgicon-plugin-02', function(root, context){

        // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
        const OPTS = bus.at('视图编译选项');
        root.walk( OPTS.TypeAttributeName, (node, object) => {
            if ( !node.parent ) return;

            let eqNode = node.after();
            if ( eqNode && eqNode.type === OPTS.TypeEqual ) {
                // 键=值的三个节点
                let valNode = eqNode.after();
                let oAttr = {type: 'Attribute', name: object.value, value: valNode.object.value, isExpression: false, loc: context.input.loc};
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
                eqNode.remove();
                valNode.remove();

            } else {
                // 单一键节点（应该没有...）
                let oAttr = {type: 'Attribute', name: object.value, value: true, isExpression: false, loc: context.input.loc}
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
            }
        });

    });
}());

bus.on('SVG图标文件解析插件', function(){
    
    return postobject.plugin('svgicon-plugin-03', function(root, context){

        // 多个属性节点合并为一个标签属性节点
        root.walk( 'Attribute', (node, object) => {
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

bus.on('SVG图标文件解析插件', function(){
    
    // 自关闭标签统一转换为Tag类型节点
    return postobject.plugin('svgicon-plugin-04', function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeTagSelfClose, (node, object) => {
            if ( !node.parent ) return;

            let type = 'Tag';
            let value = object.value;
            let loc = context.input.loc;
            let tagNode = this.createNode({type, value, loc})

            let tagAttrsNode = node.after();
            if ( tagAttrsNode && tagAttrsNode.type === 'Attributes' ) {
                tagNode.addChild(tagAttrsNode.clone());
                tagAttrsNode.remove();
            }

            node.replaceWith(tagNode);
        });

    });

}());

bus.on('SVG图标文件解析插件', function(){
    
    // 开闭标签统一转换为Tag类型节点
    return postobject.plugin('svgicon-plugin-05', function(root, context){

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

        context.result = root.nodes[0];

    });

}());


bus.on('SVG图标文件解析插件', function(){
    
    // 仅保留顶部svg标签
    return postobject.plugin('svgicon-plugin-11', function(root, context){
        root.walk( (node, object) => {
            if ( node.parent === root && ( node.type !== 'Tag' || !/^svg$/i.test(object.value) ) ) {
                node.remove();      // 在顶部的，非<svg>标签全删除 （注释、文本等）
            }
        });
    });

}());


bus.on('SVG图标文件解析插件', function(){
    
    // 没有viewBox时，按width、height计算后插入viewBox属性 （如果width或height也没设定，那就不管了，设定的单位不是px也不管了）
    return postobject.plugin('svgicon-plugin-12', function(root, context){
        root.walk( 'Attributes', (node, object) => {
            if ( !node.parent || node.parent.parent !== root ) return;

            // 没有viewBox时，按width、height计算后插入viewBox属性 （如果width或height也没设定，那就不管了）
            let ndWidth, ndHeight, ndViewBox;
            node.nodes.forEach(nd => {
                /^width$/i.test(nd.object.name) && (ndWidth = nd);
                /^height$/i.test(nd.object.name) && (ndHeight = nd);
                /^viewbox$/i.test(nd.object.name) && (ndViewBox = nd);
            });

            if ( !ndViewBox && ndWidth && ndHeight && /^\d+(px)?$/i.test(ndWidth.object.value) && /^\d+(px)?$/i.test(ndHeight.object.value) ) {
                ndViewBox = ndWidth.clone();
                ndViewBox.object.name = 'viewBox'
                ndViewBox.object.value = `0 0 ${parseInt(ndWidth.object.value)} ${parseInt(ndHeight.object.value)}`;
                node.addChild(ndViewBox);   // 插入 viewBox 属性
            }
        
        });
    });

}());


bus.on('SVG图标文件解析插件', function(){
    
    // 删除svg标签中一些要忽略的属性，同时用svgicon标签中的自定义属性覆盖(viewBox不覆盖)，达到像直接写svg属性一样的效果
    return postobject.plugin('svgicon-plugin-13', function(root, context){

        let svgAttrs = context.svgAttrs = {};   // 保存svg属性
        root.walk( 'Attributes', (node, object) => {
            if ( !node.parent || node.parent.parent !== root ) return;

            // 全部svg属性保存后删除
            node.walk( (nd, obj) => {
                svgAttrs[obj.name] = obj.value;
                nd.remove();
            });
        });

        // 删除svg中的指定属性
        delete svgAttrs['id'];
        delete svgAttrs['class'];
        delete svgAttrs['xmlns'];
        delete svgAttrs['version'];
        delete svgAttrs['xmlns:xlink'];
        delete svgAttrs['xml:space'];
        delete svgAttrs['x'];
        delete svgAttrs['y'];

        // 用svgicon属性覆盖svg属性
        let oAttrs = Object.assign(svgAttrs, context.input.attrs); 

        // 新属性插入节点树
        root.walk( 'Attributes', (node, object) => {
            if ( !node.parent || node.parent.parent !== root ) return;

            for ( let name in oAttrs ) {
                node.addChild( this.createNode({type: 'Attribute', name, value: oAttrs[name]}) );
            }
        
        });

    });

}());


bus.on('SVG图标文件解析插件', function(){
    
    // 最后一步，重置loc，保存解析结果
    return postobject.plugin('svgicon-plugin-99', function(root, context){
        root.walk( (node, object) => {
            object.loc = context.input.loc;
        }, {readonly: true});

        context.result = root.nodes[0];
    });

}());
