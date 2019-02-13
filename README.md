# `rpose`

[![NPM version](https://img.shields.io/npm/v/@rpose/cli.svg)](https://www.npmjs.com/package/@rpose/cli)
[![License](https://img.shields.io/badge/License-Apache%202-brightgreen.svg)](http://www.apache.org/licenses/LICENSE-2.0)
<br>
<br>

> 《RPOSE从入门到精通》在哪里？

没有的事，这是一个前端框架，简单到没法聊<br>
<br>



<br>
了解请看 https://gotoeasy.github.io

<br>
<br>
有好姿势欢迎提Issuse

<br>
<br>

## `青松的姿势`
<details>
<summary><strong>hello world</strong></summary>

```
// hello-world.rpose
[view]
<span>hello {name}!</span>

[state]
{name: 'world'}

[mount]
body
```
[live demo](https://gotoeasy.github.io/build/dist/live-demo/hello-world.html)
</details>

<details>
<summary><strong>todo-list</strong></summary>

```
// todo-list.rpose
[view]
<div>
    <div class="title">TODO LIST</div>
    <ul>
        {% for ( let i=0; i<$state.items.length; i++ ) { %}
        <li><button style="margin-right:20px" index={i} onclick="del">Del</button> { $state.items[i] }</li>
        {% } %}
    </ul>

    <form onsubmit="add">
        <input type="text" ref="input">
        <button>Add #{ $state.items.length + 1 }</button>
    </form>
</div>

[state]
{
    items: []
}

[actions]
{
    add: e => {
        e.preventDefault();
        let el = this.getRefElement('input');
        el.value && this.$state.items.push(el.value) && (el.value = '');
        this.render();
    },
    del: e => {
        let index = e.target.getAttribute('index');
        this.$state.items.splice(index, 1);
        this.render();
    }
}

[css]
.title {
    font-size: 18px;
}

[mount]
body
```
[live demo](https://gotoeasy.github.io/build/dist/live-demo/todo-list.html)
</details>


<details>
<summary><strong>layout</strong></summary>

```
// layout-foo.rpose
[view]
<div class='layout'>
    <div class='layout-header'><slot name="header"/></div> 
    <div class='layout-body'><slot name="body"/></div> 
    <div class='layout-footer'><slot name="footer"/></div> 
</div> 

[less]
body{
    margin: 0;
}

.layout {
    height: 100vh;
    .display(flex);
    .flex-direction(column);
    overflow: hidden;
}

.layout-header {
    height: 50px;
    color: #fff;
    background-color: #385691;
}

.layout-body {
    .calc(height, ~'100% - '80px);
    background-color: #F8F8F8;
}

.layout-footer {
    height: 30px;
    background-color: #F2F2F2;
}
```

```
// page-foo.rpose
[view]
<layout-foo>
    <div slot="header">
        <div style="text-align:center;padding-top:13px">Welcome</div>
    </div> 
    <div slot="body">
        <div style="margin-top:150px;text-align:center;font-size:3rem">FOO</div>
    </div>
    <div slot="footer">
        <div style="text-align:center;padding-top:3px">footer</div>
    </div> 
</layout-foo> 

[mount]
body
```
[live demo](https://gotoeasy.github.io/build/dist/live-demo/page-foo.html)
</details>

<br>
<br>

## `安装使用`

* `@rpose/cli`: [README.md](https://github.com/gotoeasy/rpose/blob/master/cli/README.md)

<br>
<br>


## `TODO`
- [ ] 改进重构完善
- [ ] 例子以及文档
- [ ] 新特性好姿势

<br>



## `变更列表`
<details>
<summary><strong>Ver 0.2.2</strong></summary>

- [x] 配置文件`rpose.config.btf`添加`[import]`设定<br>该配置是`@import`指令的全局性表达，用于统一配置组件引用，省略逐个书写`@import`<br>如<br>[import]<br>ui-button : @gotoeasy/bootstrap<br>c-btn : @gotoeasy/bootstrap:ui-button<br>
- [x] 新增指令`@show`<br>相应标签将添加或删除样式类`hidden`控制是否显示
</details>

<details>
<summary><strong>Ver 0.2.1</strong></summary>

- [x] 指令统一前缀为`@`，以方便阅读识别<br>新增`@ref`替代原有ref指令，原ref指令将废弃
- [x] 新增指令`@import`<br>自动安装导入npm上指定包的组件，声明式引用的体验<br><br>如&lt;ui-button @import="@gotoeasy/bootstrap"&gt;按钮&lt;/ui-button&gt;<br>意思上如同import ui-button from @gotoeasy/bootstrap<br>也可以写成&lt;c-btn @import="@gotoeasy/bootstrap:ui-button"&gt;按钮&lt;/c-btn&gt;<br>意思上如同import ui-button from @gotoeasy/bootstrap as c-btn
</details>

<details>
<summary><strong>Ver 0.1.5</strong></summary>

- [x] 新增逻辑判断指令`@if`<br>
- [x] 针对LESS、SCSS，自动添加node_modules所在目录为关联目录<br>以方便使用 `@import "node_modules/..."；`导入相关文件<br>
- [x] 缓存目录放到当前工作路径的`.cache`目录下，方便确认或删除<br>
</details>

<details>
<summary><strong>Ver 0.1.4</strong></summary>

- [x] 增量编译支持，大幅提高编译性能<br>基于磁盘缓存实现，若要禁止磁盘缓存，使用参数`--nocache`<br>
- [x] 其他细节改进<br>
</details>

<details>
<summary><strong>Ver 0.1.3</strong></summary>

- [x] 提供简便易用的前端路由方案<br>
- [x] 改进class属性写法体验，支持混合表达式写法<br>如 class="foo {bar:$options.bar, hide:!$state.show} foobar"<br>等同 class={foo：1, bar:$options.bar, hide:!$state.show, foobar:1}
- [x] 改善体验，自动安装`rpose.config.btf`中配置的依赖模块<br>
- [x] 细节改进及BUG修改<br>
</details>

<details>
<summary><strong>Ver 0.1.2</strong></summary>

- [x] 提供预渲染(html页面源码的生成)方案，模块化可配置化，以灵活应付Loader或骨架屏等需求<br>
</details>

<details>
<summary><strong>Ver 0.1.1</strong></summary>

- [x] 统一哈希算法，自动调整img标签src属性的相对路径，确保不同目录页面都正常显示<br>
</details>

<details>
<summary><strong>Ver 0.1.0 概念版</strong></summary> 

- [x] 人性化的BTF格式源文件，舒适的开发体验<br>
- [x] 回归自然，三驾马车HTML/JS/CSS，写业务，完成<br>
- [x] 严格控制接口概念，保持简易性，杜绝过度开发<br>
- [x] 数据驱动、组件式、响应式、声明式的开发过程<br>
- [x] 虚拟DOM及局部差异渲染<br>
- [x] CSS支持LESS、SCSS等预处理，集成添加前缀、自动调整URL、去重复优化等后处理<br>
- [x] 组件单位哈希化CSS类名，组件内类名无重复则不会有冲突，样式命名舒坦了<br>
- [x] 提供组件样式风格统一性方案<br>
- [x] 命令行提供监视功能，源文件修改时自动编译，热更新浏览器<br>
- [x] 命令行提供打包功能，配置要兼容的目标浏览器清单，直接打包成品<br>
</details>

<br>

## LIST
* `@rpose/cli`: [![NPM version](https://img.shields.io/npm/v/@rpose/cli.svg)](https://www.npmjs.com/package/@rpose/cli) https://github.com/gotoeasy/rpose/blob/master/cli/README.md

