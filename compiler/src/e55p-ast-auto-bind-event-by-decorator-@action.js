const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 根据装饰器@action设定，自动绑定事件（添加事件属性）
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let fnCreateNode = data => this.createNode(data);               // 创建AST节点

        let oMethods = context.script.Method;                           // 方法对象（方法名: {Name, decorators[{Name,Event,Selector}]}）
        let oMethod, decorators;
        for ( let method in oMethods ) {
            oMethod = oMethods[method];
            decorators = oMethod.decorators;
            if ( !decorators || !decorators.length ) continue;

            for ( let i=0,oDecorator,tagNodes; oDecorator=decorators[i++]; ) {
                tagNodes = queryNodes(root, oDecorator.Selector.value);
                if ( !tagNodes.length ) {
                    // 按选择器找不到标签
                    throw new Err(`tag not found by the selector (${oDecorator.Selector.value})`, {...context.input, ...oDecorator.Selector});
                }
                bindEventHandle(oMethod, oDecorator, tagNodes, fnCreateNode);
            }
        }

    });

}());

function bindEventHandle(oMethod, oDecorator, tagNodes=[], fnCreateNode){
    tagNodes.forEach(tagNode => {

        // 查找/创建事件组节点
        let eventsNode = getEventsNode(tagNode);
        if ( !eventsNode ) {
            eventsNode = fnCreateNode( {type: 'Events'} );
            tagNode.addChild(eventsNode);
        }

        // 创建事件节点
        let type = 'Event';
        let name = oDecorator.Event.value;                                                          // 事件名，如： onclick
        let Name = { pos: {start: oDecorator.Event.start, end: oDecorator.Event.end} };
        let value = 'this.' + oMethod.Name.value;                                                   // 方法名，如： fnClick
        let Value = { pos: {start: oMethod.Name.start, end: oMethod.Name.end} };
        let isExpression = false;
        let pos = {start: oMethod.Name.start, end: oMethod.Name.end};
        let eventNode = fnCreateNode( {type, name, Name, value, Value, isExpression, pos} );
        
        // 添加事件节点
        eventsNode.addChild(eventNode);
    });
}

function getEventsNode(tagNode){
    let nodes = tagNode.nodes || [];
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'Events' ) {
            return node;
        }
    }
}

// -----------------------------------------------
// TODO 在组件的[view]中按标签名查找匹配的标签
// 同样式的标签名选择器语法，大于号指子标签，空格指子孙标签
function queryNodes(root, selector){

    let nodes = [];
    root.walk( 'Tag', (node, object) => {
        if ( object.value === selector ) {
            nodes.push(node);
        }

    });

    return nodes;
}
