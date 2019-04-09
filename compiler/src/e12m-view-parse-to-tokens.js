const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

// 自闭合标签
const SELF_CLOSE_TAGS = 'br,hr,input,img,meta,link,area,base,basefont,bgsound,col,command,isindex,frame,embed,keygen,menuitem,nextid,param,source,track,wbr'.split(',');

// TODO 未转义字符引起的解析错误，友好提示

// \{ = '\u0000\u0001', \} = '\ufffe\uffff'
function escape(str){
    return str == null ? null : str.replace(/\\{/g, '\u0000\u0001').replace(/\\}/g, '\ufffe\uffff');
}
function unescape(str){
    return str == null ? null : str.replace(/\u0000\u0001/g, '{').replace(/\ufffe\uffff/g, '}');
}

function getLocation(src, startPos, endPos, PosOffset){
    let ary, line, start = {}, end = {};

    ary = src.substring(0, startPos + PosOffset).split('\n');
    start.line = ary.length;
    line = ary.pop();
    start.column = line.length + 1;
    start.pos = PosOffset + startPos;

    ary = src.substring(0, endPos + PosOffset).split('\n');
    end.line = ary.length;
    line = ary.pop();
    end.column = line.length;
    end.pos = PosOffset + endPos;
    if ( !line.length ) {
        end.line--;
        end.column = ary.pop().length + 1;
    }

    return {start, end};
}

function TokenParser(fileText, viewText, file, PosOffset){

    let src = escape(viewText);
    // ------------ 变量 ------------
    let options = bus.at('视图编译选项');
    let reader = bus.at('字符阅读器', src);
    let tokens = [];

    // ------------ 接口方法 ------------
    // 解析
    this.parse = function() {
        while ( parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseHighlight() || parseText() ) {}
        //while ( parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseText() ) {}

        tokens.forEach(token => {
            token.loc = getLocation(fileText, token.pos.start, token.pos.end, PosOffset);
            delete token.pos;
        });
        return tokens;
    }

    // ------------ 内部方法 ------------
    // HTML节点
    function parseNode() {
        let pos = reader.getPos();
        if ( reader.getCurrentChar() !== '<' || reader.eof() || reader.getNextString(4) === '<!--' || reader.getNextString(9) === '<![CDATA['
            || src.indexOf(options.CodeBlockStart, pos) == pos || src.indexOf(options.ExpressionStart, pos) == pos ) {
            return 0;
        }

        let token, tagNm = '', oPos;

        // -------- 标签闭合 --------
        if ( reader.getNextString(2) === '</' ) {
            let idx = src.indexOf('>', pos+3);
            if ( idx < 0 ) {
                return 0; // 当前不是节点闭合标签(【</xxx>】)
            }else{
                oPos = {};
                oPos.start = reader.getPos();
                reader.skip(2); // 跳过【</】
                while ( reader.getCurrentChar() !== ">" && !reader.eof() ) {
                    tagNm += reader.readChar();    // 只要不是【>】就算标签闭合名
                }
                reader.skip(1); // 跳过【>】
                oPos.end = reader.getPos();

                token = { type: options.TypeTagClose, value: tagNm.trim(), pos: oPos };    // Token: 闭合标签
                tokens.push(token);
                return 1;
            }
        }

        // -------- 标签开始 --------
        // 简单检查格式
        if ( reader.getCurrentChar() === '<' && src.indexOf('>', pos+2) < 0 ) {
            return 0; // 当前不是节点开始(起始【<】，但后面没有【>】)
        }

        if ( !/[a-z]/i.test(reader.getNextChar()) ) {
            // 标签名需要支持特殊字符时需相应修改
            return 0;                                   // 当前不是节点开始(紧接【<】的不是字母)
        }

        // 节点名
        oPos = {};
        oPos.start = reader.getPos();
        reader.skip(1);    // 跳过起始【<】
        while ( /[^\s\/>]/.test(reader.getCurrentChar())  ) {
            tagNm += reader.readChar(); // 非空白都按名称处理
        }

        let tokenTagNm = { type: '', value: unescape(tagNm).trim(), pos: oPos };    // Token: 标签 (类型待后续解析更新)
        tokens.push(tokenTagNm);

        // 全部属性
        while ( parseAttr() ) {}

        // 跳过空白
        reader.skipBlank();

        // 检查标签结束符
        if ( reader.getNextString(2) === '/>' ) {
            // 无内容的自闭合标签，如<one-tag/>
            tokenTagNm.type = options.TypeTagSelfClose; // 更新 Token: 标签
            reader.skip(2);    // 跳过【/>】
            oPos.end = reader.getPos();
            return 1;
        }

        if ( reader.getCurrentChar() === '>' ) {
            // 默认可以自闭合的标签（如<br>）
            if ( SELF_CLOSE_TAGS.includes(tagNm.toLowerCase()) ) {
                tokenTagNm.type = options.TypeTagSelfClose; // 更新 Token: 标签
            }else{
                tokenTagNm.type = options.TypeTagOpen; // 更新 Token: 标签
            }

            reader.skip(1);    // 跳过【>】
            oPos.end = reader.getPos();
            return 1;

        }

        // 前面已检查，不应该走到这里
        throw new Err('tag missing ">"', 'file=' + file, {text: fileText, start: oPos.start + PosOffset});
    }



    // HTML节点属性
    function parseAttr() {
        if ( reader.eof() ) {
            return 0;
        }

        // 跳过空白
        reader.skipBlank();
        let oPos = {};
        oPos.start = reader.getPos();

        // 读取属性名
        let key = '', val = '';
        if ( reader.getCurrentChar() === '{' ) { // TODO 根据配置符号判断, 考虑误解析情况
            let stack = [];
            key += reader.readChar(); // 表达式开始
            while ( !reader.eof() ) {
                if ( reader.getCurrentChar() === '{' ) {
                    if ( reader.getPrevChar() !== '\\' ) {
                        stack.push('{');                        // TODO 表达式中支持写{....}, 但字符串包含表达式符号将引起混乱误解析，编写时应避免
                    }
                }
                if ( reader.getCurrentChar() === '}' ) {
                    if ( reader.getPrevChar() !== '\\' ) {
                        if ( !stack.length ) {
                            // 表达式结束
                            key += reader.readChar();
                            break; // 退出循环
                        }
                        stack.pop();
                    }
                }
                key += reader.readChar();
            }
            if ( !key ) return 0;

        }else{
            while ( /[^\s=\/>]/.test(reader.getCurrentChar()) ) {
                key += reader.readChar();    // 只要不是【空白、等号、斜杠、大于号】就算属性名
            }
            if ( !key ) return 0;
        }

        oPos.end = reader.getPos();

        let token = { type: options.TypeAttributeName, value: unescape(key), pos: oPos };    // Token: 属性名
        tokens.push(token);

        // 跳过空白
        reader.skipBlank();
        oPos = {};
        oPos.start = reader.getPos();

        if ( reader.getCurrentChar() === '=' ) {
            oPos.end = reader.getPos()+1;
            token = { type: options.TypeEqual, value: '=', pos: oPos };    // Token: 属性等号
            tokens.push(token);

            // --------- 键值属性 ---------
            let PosEqual = reader.getPos()+PosOffset+1;
            reader.skip(1);        // 跳过等号
            reader.skipBlank(); // 跳过等号右边空白
            oPos = {};
            oPos.start = reader.getPos();

            if ( reader.getCurrentChar() === '"' ) {
                // 值由双引号包围
                reader.skip(1);    // 跳过左双引号
                let posStart = reader.getPos();
                while ( !reader.eof() && reader.getCurrentChar() !== '"' ) {
                    let ch = reader.readChar();
                    (ch !== '\r' && ch !== '\n') && (val += ch);    // 忽略回车换行，其他只要不是【"】就算属性值
                }

                if ( reader.eof() || reader.getCurrentChar() !== '"' ) {
                    // 属性值漏一个双引号，如<tag aaa=" />
                    throw new Err('invalid attribute value format (missing ")', 'file=' + file, {text: fileText, start: PosEqual, end: posStart+PosOffset});
                }

                reader.skip(1);    // 跳过右双引号
                oPos.end = reader.getPos();

                token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos };    // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                tokens.push(token);
            }else if ( reader.getCurrentChar() === "'" ) {
                // 值由单引号包围
                reader.skip(1);    // 跳过左单引号
                let posStart = reader.getPos();
                while ( !reader.eof() && reader.getCurrentChar() !== "'" ) {
                    let ch = reader.readChar();
                    (ch != '\r' && ch != '\n') && (val += ch);    // 忽略回车换行，其他只要不是【'】就算属性值
                }

                if ( reader.eof() || reader.getCurrentChar() !== "'" ) {
                    // 属性值漏一个单引号，如<tag aaa=' />
                    throw new Err("invalid attribute value format (missing ')", 'file=' + file, {text: fileText, start: PosEqual, end: posStart+PosOffset});
                }

                reader.skip(1);    // 跳过右单引号
                oPos.end = reader.getPos();

                token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos };    // Token: 属性值(属性值中包含表达式组合的情况，在syntax-ast-gen中处理)
                tokens.push(token);
            }else if ( reader.getCurrentChar() === "{" ) {
                // 值省略引号包围
                let stack = [];
                let posStart = reader.getPos()+1;
                while ( !reader.eof() ) {
                    if ( reader.getCurrentChar() === "{" ) {
                        stack.push('{');
                    }else if ( reader.getCurrentChar() === "}" ) {
                        if ( !stack.length ) {
                            break;
                        }else if ( stack.length === 1 ){
                            val += reader.readChar();    // 表达式结束
                            break;
                        }else{
                            stack.pop();
                        }
                    }
                    val += reader.readChar();    // 只要不是【'】就算属性值
                }
                if ( reader.eof() ) {
                    // 属性值漏，如<tag aaa={ />
                    throw new Err('invalid attribute value format (missing })', 'file=' + file, {text: fileText, start: PosEqual, end: posStart+PosOffset});
                }
                oPos.end = reader.getPos();
                token = { type: options.TypeAttributeValue, value: unescape(val), pos: oPos };    // Token: 属性值
                tokens.push(token);
            }else{
                // 值应该是单纯数值
                while ( /[^\s\/>]/.test(reader.getCurrentChar()) ) {
                    val += reader.readChar();    // 连续可见字符就放进去
                }

                if ( !val ) {
                    // 属性值漏，如<tag aaa= />
                    throw new Err('missing attribute value', 'file=' + file, {text: fileText, start: PosEqual, end: PosEqual+1});
                }
                if ( !/^(\d+|\d+\.?\d+)$/.test(val) ) {
                    // 属性值不带引号或大括号，应该是单纯数值，如果不是则报错，如<tag aaa=00xxx  />
                    throw new Err('invalid attribute value', 'file=' + file, {text: fileText, start: PosEqual, end: reader.getPos()+PosOffset});
                }

                oPos.end = reader.getPos();
                token = { type: options.TypeAttributeValue, value: val-0, pos: oPos };    // Token: 属性值
                tokens.push(token);
            }

        }else{
            // --------- boolean型无值属性 ---------
        }

        return 1;
    }

    // HTML注释
    function parseComment() {
        let token, pos = reader.getPos();
        let idxStart = src.indexOf('<!--', pos), idxEnd = src.indexOf('-->', pos+4);
        if ( idxStart === pos && idxEnd > pos ) {
            // 起始为【<!--】且后面有【-->】
            let oPos = {};
            oPos.start = idxStart;
            oPos.end = idxEnd + 3;
            token = { type: options.TypeHtmlComment, value: unescape(src.substring(pos+4, idxEnd)), pos: oPos };    // Token: HTML注释
            reader.skip(idxEnd+3-pos); // 位置更新

            tokens.push(token);
            return 1;
        }

        return 0;
    }

    // CDATA，转换为文本及表达式组合
    function parseCdata() {
        let token, pos = reader.getPos();
        let idxStart = src.indexOf('<![CDATA[', pos), idxEnd = src.indexOf(']]>', pos+9);
        if ( idxStart === pos && idxEnd > pos ) {
            // 起始为【<![CDATA[】且后面有【]]>】
            let oPos = {};
            oPos.start = idxStart;
            oPos.end = idxEnd + 3;
            let value = escape(src.substring(pos+9, idxEnd));
            reader.skip(idxEnd+3-pos); // 位置更新

            if ( !/\{.*?}/.test(value) ) {
                // 不含表达式
                token = { type: options.TypeText, value, pos: oPos };    // Token: 无表达式的文本
                tokens.push(token);
            }else{

                let idx1, idx2, txt, iStart=idxStart+9, oPosTxt;
                while ( (idx1 = value.indexOf('{')) >= 0 && (idx2 = value.indexOf('}', idx1)) > 0 ) {
                    if ( idx1 > 0 ) {
                        txt = unescape(value.substring(0, idx1));
                        oPosTxt = {start: iStart, end: iStart+txt.length};
                        iStart = oPosTxt.end;
                        token = { type: options.TypeText, value: txt, pos: oPosTxt };    // Token: 无表达式的文本
                        tokens.push(token);
                    }

                    txt = unescape(value.substring(idx1, idx2+1));
                    oPosTxt = {start: iStart, end: iStart+txt.length};
                    iStart = oPosTxt.end;
                    token = { type: options.TypeExpression, value: txt, pos: oPosTxt };    // Token: 表达式文本
                    tokens.push(token);
                    value = value.substring(idx2+1);
                }
                if ( value ) {
                    txt = unescape(value);
                    oPosTxt = {start: iStart, end: iStart+txt.length};
                    iStart = oPosTxt.end;
                    token = { type: options.TypeText, value: txt, pos: oPosTxt };    // Token: 无表达式的文本
                    tokens.push(token);
                }
            }

            return 1;
        }

        return 0;
    }

    // 代码高亮 ```
    function parseHighlight() {
        let pos = reader.getPos(), start, end;
        if (!(  (pos === 0 || reader.getPrevChar() === '\n') && src.indexOf('```', pos) === pos && src.indexOf('\n```', pos+3) > 0  )) {
            // 当前位置开始不是代码高亮块时，跳出不用处理
            return 0;
        }
            
        let str = src.substring(pos);
        let rs = /(^```[\s\S]*?\r?\n)([\s\S]*?)\r?\n```[\s\S]*?\r?(\n|$)/.exec(str);
        let len = rs[0].length;

        // 【Token】 <```>
        let token, oPos={};
        start = pos;
        end = pos + len;
        token = { type: options.TypeTagSelfClose, value: '```', pos: {start, end} };            // Token: 代码标签
        tokens.push(token);

        // 【Token】 lang
        let match = rs[1].match(/\b\w*\b/);    // 语言（开始行中的单词，可选）
        let lang = match ? match[0].toLowerCase() : '';
        if ( lang ) {
            start = pos + match.index;
            end = start + lang.length;
            token = { type: options.TypeAttributeName, value: 'lang', pos: {start, end} };
            tokens.push(token);
            token = { type: options.TypeEqual, value: '=', pos: {start, end} };
            tokens.push(token);
            token = { type: options.TypeAttributeValue, value: lang, pos: {start, end} };
            tokens.push(token);
        }

        // 【Token】 height
        match = rs[1].match(/\b\d+(\%|px)/i);                        // 带单位（%或px）的高度
        let height;
        if ( match ) {
            height = match[0];
        }else {
            match = rs[1].match(/\b\d+/i);                           // 不带单位的高度（开始行中的数字，可选）
            match && (height = match[0]);
        }
        if ( height ) {
            start = pos + match.index;
            end = start + height.length;
            token = { type: options.TypeAttributeName, value: 'height', pos: {start, end} };
            tokens.push(token);
            token = { type: options.TypeEqual, value: '=', pos: {start, end} };
            tokens.push(token);
            height = /^\d+$/.test(height) ? (height + 'px') : height;   // 默认单位px
            token = { type: options.TypeAttributeValue, value: height, pos: {start, end} };
            tokens.push(token);
        }

        // 【Token】 ref                                         // ???? TODO ...............................
        match = rs[1].match(/\bref\s?=\s?"(.*?)"/i);
        let ref = match && match[0] ? match[0] : '';
        if ( ref ) {
            token = { type: options.TypeAttributeName, value: 'ref', pos: {start, end} };
            tokens.push(token);
            token = { type: options.TypeEqual, value: '=', pos: {start, end} };
            tokens.push(token);
            token = { type: options.TypeAttributeValue, value: ref, pos: {start, end} };
            tokens.push(token);
        }

        // 【Token】 $CODE
        let $CODE = rs[2].replace(/\u0000\u0001/g, '\\{').replace(/\ufffe\uffff/g, '\\}');    // 转义，确保值为原输入
        $CODE = $CODE.replace(/\n\\+```/g, match => '\n' + match.substring(2));               // 删除一个转义斜杠     \n\``` => \n``` ，  \n\\``` => \n\```
        /^\\+```/.test($CODE) && ($CODE = $CODE.substring(1));                                // 删除一个转义斜杠     \``` => ``` ，  \\``` => \```

        // 属性值中的大括号会被当做表达式字符解析，需要转义掉
        $CODE = $CODE.replace(/\{/g, '\\{').replace(/\}/g, '\\}')

        start = pos + rs[1].length;
        end = start + rs[2].length;
        token = { type: options.TypeAttributeName, value: '$CODE', pos: {start, end} };
        tokens.push(token);
        token = { type: options.TypeEqual, value: '=', pos: {start, end} };
        tokens.push(token);
        token = { type: options.TypeAttributeValue, value: $CODE, pos: {start, end} };
        tokens.push(token);


        reader.skip(len); // 位置更新
        return 1;
    }

    // 代码块 {% %}
    function parseCodeBlock() {
        let token, pos = reader.getPos();
        let idxStart = src.indexOf(options.CodeBlockStart, pos), idxEnd = src.indexOf(options.CodeBlockEnd, pos + options.CodeBlockStart.length);
        if ( idxStart === pos && idxEnd > 0 ) {
            // 起始为【{%】且后面有【%}】
            let oPos = {};
            oPos.start = idxStart;
            oPos.end = idxEnd + options.CodeBlockEnd.length;
            token = { type: options.TypeCodeBlock, value: unescape(src.substring(pos + options.CodeBlockStart.length, idxEnd)), pos: oPos }; // Token: 代码块
            reader.skip(idxEnd + options.CodeBlockEnd.length - pos); // 位置更新

            tokens.push(token);
            return 1;
        }
        
        return 0;
    }

    // 文本
    function parseText() {
        if ( reader.eof() ) {
            return 0;
        }
        let oPos = {};
        oPos.start = reader.getPos();

        let token, text = '', pos;
        while ( !reader.eof() ) {
            text += reader.readChar();
            pos = reader.getPos();

            if ( reader.getCurrentChar() === '<' || reader.getNextString(3) === '```' || src.indexOf(options.CodeBlockStart, pos) === pos
                || src.indexOf(options.ExpressionStart, pos) === pos ) {
                break; // 见起始符则停
            }
        }

        if ( text ) {
            oPos.end = reader.getPos();
            token = { type: options.TypeText, value: unescape(text), pos: oPos };    // Token: 文本
            tokens.push(token);
            return 1;
        }

        return 0;
    }

    // 表达式 { }
    function parseExpression() {
        if ( reader.eof() ) {
            return 0;
        }

        let token;
        let oPos = {};
        oPos.start = reader.getPos();
        token = parseExpr();

        if ( token ) {
            oPos.end = reader.getPos();
            token.pos = oPos;
            tokens.push(token);
            return 1;
        }
        return 0;
    }

    function parseExpr() {
        let pos = reader.getPos();
        let idxStart = src.indexOf(options.ExpressionStart, pos), idxEnd = src.indexOf(options.ExpressionEnd, pos + options.ExpressionStart.length);
        if ( idxStart === pos && idxEnd > 0 ) {
            let rs = { type: options.TypeExpression, value: unescape(src.substring(pos, idxEnd + options.ExpressionEnd.length)) }; // Token: 表达式(保留原样)
            reader.skip(idxEnd + options.ExpressionEnd.length - pos); // 位置更新
            return rs;
        }
        return null;
    }

}


bus.on('视图TOKEN解析器', function(fileText, srcView, file, PosOffset){
    return new TokenParser(fileText, srcView, file, PosOffset);
});

