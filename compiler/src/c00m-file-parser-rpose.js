const bus = require('@gotoeasy/bus');

// ---------------------------------------------------
// RPOSE源文件解析
// ---------------------------------------------------
bus.on('RPOSE源文件解析', function(){

    return function(text){
        let lines = text.split('\n');                                                                   // 行内容包含换行符
        let lineCounts = [];                                                                            // 行长度包含换行符
        for ( let i=0,max=lines.length; i<max; i++ ) {
            lines[i] += '\n';                                                                           // 行内容包含换行符
            lineCounts[i] = lines[i].length;                                                            // 行长度包含换行符
        }

        let nodes = [];
        parse(nodes, lines, lineCounts);

        nodes.forEach(block => {
            let type = 'RposeBlockText';
            if ( block.buf.length ) {
                // 值
                let lastLine = block.buf.pop();
                let tmp = lastLine.replace(/\r?\n$/, '');                                               // 删除最后一行回车换行符
                tmp && block.buf.push(tmp);                                                             // 删除最后一行回车换行符后仍有内容则加回去
                let value = block.buf.join('');                                                         // 无损拼接

                // 开始位置
                let start = sumLineCount(lineCounts, block.startLine);                                  // 块内容开始位置（即块名行为止合计长度）
                // 结束位置
                let end = sumLineCount(lineCounts, block.startLine + block.buf.length-1) + tmp.length;

                block.text = { type, value, pos:{start, end} }
            }else{
                // 值
                let value = '';
                // 开始位置
                let start = sumLineCount(lineCounts, block.startLine);                                  // 块内容开始位置（即块名行为止合计长度）
                // 结束位置
                let end = start;

                block.text = { type, value, pos:{start, end} }
            }
            delete block.buf;
        });
        return {nodes};
    };

}());


function parse(blocks, lines, lineCounts) {

    let sLine,block,oName,comment,blockStart = false;
    for ( let i=0; i<lines.length; i++ ) {
        sLine = lines[i];

        if ( isBlockStart(sLine) ) {
            // 当前是块名行 [nnn]
            block = {type: 'RposeBlock'};
            oName = getBlockName(sLine);                                                                // oName.len包含转义字符长度
            comment = sLine.substring(oName.len + 2).replace(/\r?\n$/, '');                             // 块注释，忽略换行符
            
            let start = sumLineCount(lineCounts, i);                                                    // 开始位置信息，含左中括号
            let end = start + oName.len + 2;                                                            // 结束位置信息，含右中括号
            block.name = {type: 'RposeBlockName', value: oName.name, pos:{start, end} };                // 位置包含中括号
            if ( comment ) {
                start = end;                                                                            // 注释的开始位置=块名的结束位置
                end = start + comment.length;
                block.comment = {type: 'RposeBlockComment', value: comment, pos:{start, end} };         // 注释(不计换行符)
            }

            block.buf = [];
            block.startLine = i + 1;                                                                    // 块内容开始行

            blocks.push(block);
            blockStart = true;

        } else if ( isBlockEnd(sLine) ) {
            // 当前是块结束行 ---------
            blockStart = false;
        } else if ( isDocumentEnd(sLine) ) {
            // 当前是文档结束行 =========
            return;
        } else {
            if ( blockStart ) {
                // 当前是块内容行
                let buf = blocks[blocks.length-1].buf;
                if ( sLine.charAt(0) === '\\' && (/^\\+\[.*\]/.test(sLine) || /^\\+---------/.test(sLine) || /^\\+=========/.test(sLine)) ) {
                    buf.push( sLine.substring(1) );                                                     // 去除转义字符，拼接当前Block内容
                }else{
                    buf.push( sLine );
                }
            } else {
                // 当前是注释行(比如，块结束行之后，块开始行之前)
            }
        }

    }

}

function isBlockStart(sLine) {
    return sLine.startsWith('[') && sLine.indexOf(']') > 0;
}

function isBlockEnd(sLine) {
    return sLine.startsWith('---------');
}

function isDocumentEnd(sLine) {
    return sLine.startsWith('=========');
}

function getBlockName(sLine) {
    let name, len;

    for ( let i=1; i<sLine.length; i++) {
        if ( sLine.charAt(i-1) !== '\\' && sLine.charAt(i) === ']' ) {
            name = sLine.substring(1, i).toLowerCase();
            len = name.length;
            name = name.replace(/\\\]/g, ']');                              // 名称部分转义 [\]] => ]; 
            return {name, len};                                             // len包含转义字符长度
        }
    }

    name = sLine.substring(1, sLine.lastIndexOf(']')).toLowerCase();
    len = name.length;
    name = name.replace(/\\\]/g, ']');                                      // 最后一个]忽略转义 [\] => \; [\]\] => ]\
    return {name, len};
}

function sumLineCount(lineCounts, lineNo){
    let rs = 0;
    for ( let i=0; i<lineNo; i++ ) {
        rs += lineCounts[i];
    }
    return rs;
}

