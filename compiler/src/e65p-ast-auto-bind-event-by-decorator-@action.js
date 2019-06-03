const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 根据装饰器@action设定，自动绑定事件（添加事件属性）
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let fnCreateNode = data => this.createNode(data);                                       // 创建AST节点

        let oMethods = context.script.Method;                                                   // 方法对象（方法名: {Name, decorators[{Name,Event,Selector}]}）
        let oMethod, decorators;
        for ( let method in oMethods ) {
            oMethod = oMethods[method];
            decorators = oMethod.decorators;
            if ( !decorators || !decorators.length ) continue;

            for ( let i=0,oDecorator,oSetNodes; oDecorator=decorators[i++]; ) {
                oSetNodes = queryNodesBySelector(root, oDecorator.Selector.value);               // 按标签名查找标签，形同样式选择器，仅编译期在组件范围内查找
                if ( !oSetNodes.size ) {
                    // 按选择器找不到标签
                    throw new Err(`tag not found by the selector (${oDecorator.Selector.value})`, {...context.input, ...oDecorator.Selector});
                }
                bindEventHandle(oMethod, oDecorator, oSetNodes, fnCreateNode);
            }
        }

    });

}());

function bindEventHandle(oMethod, oDecorator, oSetNodes, fnCreateNode){
    oSetNodes.forEach(tagNode => {
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
// 在组件的[view]中按标签名查找匹配的标签
// 同样式的标签名选择器语法，大于号指子标签，空格指子孙标签，通配符*代表任意标签
function queryNodesBySelector(root, selector){

    let selectors = parseSelector(selector);
    if ( !selectors.length ) return new Set();                                                  // 无选择器

    let firstSel = selectors.splice(0, 1)[0];
    let oSetNodes = new Set( queryNodesByTypeSelector(root, 0, firstSel.selector) );            // 第一个选择器特殊，要单独查询
    if ( !selectors.length ) return oSetNodes;                                                  // 单一选择器

    // 循环查找过滤
    selectors.forEach(oSel => {
        let oSet = new Set();
        oSetNodes.forEach(node => {
            let ary = queryNodesByTypeSelector(node, oSel.type, oSel.selector);
            ary.forEach(nd => oSet.add(nd));
        });
        oSetNodes = oSet;                                                                       // 过滤
    });

    return oSetNodes;
}


// 在[view]中按标签名查找匹配的全部标签
function queryNodesByTypeSelector(node, type, selector){

    let nodes = [];
    if ( type === 1 ) {
        // 仅比较子标签节点
        node.nodes && node.nodes.forEach(nd => {
            if ( nd.type === 'Tag' && (nd.object.value === selector || selector === '*') ) {
                nodes.push(nd);
            }
        });
    }else{
        // 比较子孙标签节点
        node.walk( 'Tag', (nd, obj) => {
            if ( obj.value === selector || selector === '*' ) {
                nodes.push(nd);
            }
        });
    }
    return nodes;
}

// button => [{type: 0, selector: 'button'}]
// div * A > button => [{type: 0, selector: 'div'}, {type: 2, selector: '*'}, {type: 2, selector: 'div'}, {type: 1, selector: 'div'}
function parseSelector(selector){
    let ary = [];
    selector.trim().toLowerCase().split(/\s*>\s*/).forEach(childSel => {
        let subs = childSel.split(/\s+/);
        for ( let i=0,sel; sel=subs[i++]; ) {
            ary.push({type: (i>1?2:1), selector: sel});
        }
    });

    ary[0].type = 0;        // 第一个特殊，固定type=0
    return ary;
}
