const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

// HTML标准所定义的全部标签事件
const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        // 标准标签的事件属性提取存放到e属性中，相应节点删除
        root.walk( 'Attribute', (node, object) => {
            if ( !node.parent ) return;                                 // 跳过已删除节点
            if ( !REG_EVENTS.test(object.name) ) return;                // 跳过非事件属性节点

            // 父标签节点
            let tagNode = node.parent.parent;
            if ( !tagNode.object.standard ) {
                return;                                                 // 属于组件标签的属性时，跳过
            }

            if ( !object.value ) {
                node.remove();
                return;                                                 // 事件属性节点没有值，按未定义处理，并删除该节点
            }

            // 父标签节点的事件子节点
            let eventsNode;
            for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
                if ( nd.type === 'Events' ) {
                    eventsNode = nd;
                    break;
                }
            }
            if ( !eventsNode ) {
                eventsNode = this.createNode({type:'Events'});
                tagNode.addChild(eventsNode);
            }
            
            // 父标签节点的事件子节点中添加事件属性节点
            eventsNode.addChild( node.clone() );
            node.remove();

        });

    });

}());
