const bus = require('@gotoeasy/bus');

// 解析单个svgicon定义，转换为对象形式方便读取
bus.on('解析svgicon', function(){

    // file用于记录svgicon所在文件，便于错误提示
    return function(svgicon){

        let alias, pkg, filter, match;
        if ( (match = svgicon.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
            // alias=pkg:filter
            alias = match[1];                                                               // alias=pkg:filter => alias
            pkg = match[2];                                                                 // alias=pkg:filter => pkg
            filter = match[3];                                                              // alias=pkg:filter => filter
        }else{
            // 无效的svgicon格式
            return null;
        }

        return { alias, pkg, filter, svgicon: alias+'='+pkg+':'+filter };
    }


}());




