const bus = require('@gotoeasy/bus');

// 模板
class ClsTemplate{
    constructor(tmpl='', argNm) {
        // 模板解析函数（代码数组，模板，前一句是否JS代码）
        let fnParse = function(ary, tmpl, isPreCode){
            let tmp, idx = tmpl.indexOf('<%');
            if ( idx < 0 ){
                // Text
                ary.push(fnText(ary, tmpl, isPreCode)); // 保存解析结果
            } else if ( idx == 0 ){
                if (tmpl.indexOf('<%=') == idx){
                    // Value
                    tmpl = tmpl.substring(3);
                    idx = tmpl.indexOf('%>');
                    tmp = tmpl.substring(0, idx);

                    ary.push(ary.pop() + "+" + tmp); // 保存解析结果
                    fnParse(ary, tmpl.substring(idx+2), false); // 剩余继续解析
                } else {
                    // Code
                    tmpl = tmpl.substring(2);
                    idx = tmpl.indexOf('%>');
                    tmp = tmpl.substring(0, idx);

                    isPreCode ? ary.push(tmp) : (ary.push(ary.pop() +';') && ary.push(tmp)); // 保存解析结果
                    fnParse(ary, tmpl.substring(idx+2), true); // 剩余继续解析
                }

            } else {
                // 取出左边Text
                tmp = tmpl.substring(0, idx);
                ary.push(fnText(ary, tmp, isPreCode)) // 保存解析结果
                fnParse(ary, tmpl.substring(idx), false); // 剩余继续解析
            }
        }
        // 字符串拼接转义函数
        let fnText = function(ary, txt, isPreCode){
            let str = txt.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\'/g, "\\'");
            return isPreCode? ("s+='" + str + "'") : (ary.pop() + "+'" + str + "'");
        }

        // 创建动态函数toString，使用例子：new Template('Hello <%= data.name %>', 'data').toString({size:20}, {name:'world'})
        let aryBody = [];
        aryBody.push("let s=''")
        fnParse(aryBody, tmpl, true); // 代码数组=aryBody，模板=tmpl，前一句是否JS代码=true
        aryBody.push("return s");
        this.toString = argNm ? new Function(argNm, aryBody.join("\n") ) : new Function(aryBody.join("\n"));
    }
}

bus.on('编译模板JS', function(result){

    return function () {
        if ( !result ) {
            let tmpl = getSrcTemplate().replace(/\\/g, "\\\\");
            const clsTemplate = new ClsTemplate(tmpl, '$data');

            let fn = clsTemplate.toString
            result = ( (...args) => {
                let rs = fn(...args);
                let imagepath = args[0].imagepath;
                return imagepath ? rs.replace(/\%imagepath\%/ig, imagepath) : rs;
            });
        }

        return result;
    };

}());




function getSrcTemplate() {
    return `

// ------------------------------------------------------------------------------------------------------
// 组件 <%= $data['COMPONENT_NAME'] %>
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接调用方法或用new创建
// ------------------------------------------------------------------------------------------------------
<% if ( $data['singleton'] ){ %>
    // 这是个单例组件
    <%= $data['COMPONENT_NAME'] %>.Singleton = true;
<% } %>

// 属性接口定义
<%= $data['COMPONENT_NAME'] %>.prototype.$OPTION_KEYS = <%= JSON.stringify($data['optionkeys']) %>;  // 可通过标签配置的属性，未定义则不支持外部配置
<%= $data['COMPONENT_NAME'] %>.prototype.$STATE_KEYS = <%= JSON.stringify($data['statekeys']) %>;    // 可更新的state属性，未定义则不支持外部更新state

// 组件函数
function <%= $data['COMPONENT_NAME'] %>(options={}) {

    <% if ( $data['optionkeys'] != null ){ %>
    // 组件默认选项值
    this.$options = <%= $data['options'] %>;
    rpose.extend(this.$options, options, this.$OPTION_KEYS);    // 按属性接口克隆配置选项
    <% }else{ %>
    // 组件默认选项值
    this.$options = <%= $data['options'] %>;
    <% } %>

    <% if ( $data['statekeys'] != null ){ %>
    // 组件默认数据状态值
    this.$state = <%= $data['state'] %>;
    rpose.extend(this.$state, options, this.$STATE_KEYS);       // 按属性接口克隆数据状态
    <% }else{ %>
    // 组件默认数据状态值
    this.$state = <%= $data['state'] %>;
    <% } %>

    <% if ( $data['actions'] ){ %>
    // 事件处理器
    <%= $data['actions'] %>
    <% } %>

    <% if ( $data['methods'] ){ %>
    // 自定义方法
    <%= $data['methods'] %>;
    <% } %>

    <% if ( $data['updater'] ){ %>
    // 组件更新函数
    this.$updater = <%= $data['updater'] %>;
    <% } %>
}

/**
 * 节点模板函数
 */
<%= $data['COMPONENT_NAME'] %>.prototype.nodeTemplate = <%= $data['vnodeTemplate'] %>

`;

}
