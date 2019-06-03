const bus = require('@gotoeasy/bus');

// HTML标准所定义的全部标签事件
const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;

bus.on('是否HTML标准事件名', function (){

    return function(name, ignoreOn=false){
        if ( REG_EVENTS.test(name) ) {
            return true;
        }
        if ( ignoreOn ) {
            return REG_EVENTS.test('on' + name);
        }
        return false;
    }

}());
