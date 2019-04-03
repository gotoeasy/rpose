# `rpose`

[![NPM version](https://img.shields.io/npm/v/rpose.svg)](https://www.npmjs.com/package/rpose)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://github.com/gotoeasy/rpose/blob/master/LICENSE)
<br>
<br>

> 《RPOSE从入门到精通》在哪里？

没有的事，这是一个前端框架，简单到没法聊<br>
<br>


<br>
了解请看 https://gotoeasy.github.io

<br>
<br>
有好姿势欢迎提 Issuse

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
        <for @for="(item, i) in $state.items">
        <li><button style="margin-right:20px" index={i} onclick="del">Del</button> {item}</li>
        </for>
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.layout-header {
    height: 50px;
    color: #fff;
    background-color: #385691;
}

.layout-body {
    height: calc(100vh - 80px);
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


<details>
<summary><strong>bootstrap-button (csslibify)</strong></summary>

```
// csslibify-bootstrap-button.rpose
[view]
<button type="button" class="btn@bootstrap btn-primary@bootstrap">
    this is a bootstrap primary button
</button>

[csslib]
bootstrap = bootstrap:**/*.min.css

[mount]
body
```
[live demo](https://gotoeasy.github.io/build/dist/live-demo/csslibify-bootstrap-button.html)
</details>

<br>

## `安装使用`

* `@rpose/cli`: [README.md](https://github.com/gotoeasy/rpose/blob/master/cli/README.md)

<br>

## `功能列表`

* `feature`

- [x] 源文件使用BTF的单文档格式，人性化强，可读性高
- [x] 数据驱动、组件式、响应式、声明式的开发过程
- [x] 提供指令`@ref`、`@show`、`@if`、`@for`、`@taglib`、`@csslib`
- [x] 提供组件级和项目级的`[taglib]`配置，和`@taglib`有影响范围区别
- [x] 提供组件级和项目级的`[csslib]`配置，和`@csslib`有影响范围区别
- [x] 项目可发布为npm模块，发布内容为项目配置及源码和资源，开发工程可直接引用自动安装按需编译使用
- [x] 提供简易安全的路由方案
- [x] 提供预渲染方案
- [x] 提供样式风格方案

* `buildin`

- [x] 语法高亮组件，写法雷同md的 ` ``` `，支持`btf`、`rpose`，支持设定最大高度
- [x] 内置路由组件`<router>`、`<router-link>`
- [x] 内置标签组件 `<if>`
- [x] 内置标签组件 `<for>`

* `runtime`

- [x] 虚拟DOM及局部差异化渲染实现
- [x] 提供`on`、`at`、`once`、`off`等事件接口
- [x] 提供`$$`接口，方便dom节点选择及属性修改操作
- [x] 支持相对特殊的`<svg>`、`<script>`、`<link>`标签

* `compiler`

- [x] 编译模块插件化便于增减新功能
- [x] 支持LESS预处理
- [x] 支持SCSS预处理
- [x] 样式类名哈希化解决冲突问题，非release模式时仅友好改名以便确认
- [x] 自动转换js代码中的样式类名并统一哈希化
- [x] 样式中url的相对目录自动调整，图片资源文件名统一哈希化
- [x] 自动调整img标签中src的相对目录，让不同目录页面都能正常显示图片
- [x] 按`.browserslistrc`配置添加前缀、压缩或美化等样式后处理
- [x] 打包后的图片资源存放目录可通过项目配置文件`rpose.config.btf`配置，默认是`images`
- [x] 按`.browserslistrc`配置的目标浏览器直接打包成品
- [x] 提供样式风格模块方案
- [x] 提供预渲染模块方案
- [x] 自动安装配置依赖模块，增强开发体验，有特定版本需求时需自行安装确定版本
- [x] 组件接口属性需显式声明，方便人工阅读识别
- [x] 标签属性支持单纯对象表达式，如`<foo {$state}>`，运行期会按接口声明复制属性
- [x] 标签插槽功能支持
- [x] 虽然不提倡，但确实可以在view中写js代码
- [x] `[view]`中支持变量简写，自动检查接口声明进行关联
- [x] `[actions]`中支持对象写法和函数写法
- [x] 自动处理使this指向组件对象
- [x] 友好化错误信息提示，编译错误时准确定位
- [x] 源文件中无`[mount]`，或文件目录含`components`、`node_modules`的都视为单纯组件
- [x] 支持特殊的CDATA标签写法，方便直接书写尖括号等特殊字符
- [x] 自动删除纯注释代码块，删除空白文本表达式或纯注释文本表达式
- [x] 源文件监视，自动编译，按需热更新浏览器

* `other`

- [x] 简易实现热刷新服务器替代第三方包，方便按需刷新、按需打开窗口
- [ ] 测试及覆盖率
- [ ] 进一步优化缓存性能
- [ ] 完善例子及文档
- [ ] 改进、新特性好姿势增强

<br>

## `变更列表`
<details>
<summary><strong>Ver 0.4.x</strong></summary>

- [x] 为方便功能删减修改，咬牙重构编译器，分离`runtime`、`buildin`模块
- [x] 更多的编译期检查以及更友好的错误信息提示
- [x] 新增指令`@for`，新增内置标签`<for>`、`<if>`
- [x] 新增支持特殊的CDATA标签写法，方便直接书写尖括号等特殊字符
- [x] 改进内置的语法高亮组件，增加btf、rpose语言类型的语法高亮显示支持
- [x] 项目以源码形式发布到npm，开发工程能自动安装依赖模块，按需编译相关组件
- [x] 解决watch模式下文件重名等可能引起动态编译错误的问题
- [x] 情不得已，简陋实现热更新服务器替换第三方包，按需刷新按需开窗口，改善体验
- [x] 优化编译缓存，提升编译性能
</details>

<details>
<summary><strong>Ver 0.3.x</strong></summary>

- [x] 新添指令`@taglib`、`@csslib`，组件支持`[taglib]`、`[csslib]`块定义
</details>

<details>
<summary><strong>Ver 0.2.x</strong></summary>

- [x] 指令统一前缀为`@`以方便识别，如 `@if`、`@ref`、`@show`
</details>

<details>
<summary><strong>Ver 0.1.x 概念版</strong></summary> 

- [x] 源文件使用BTF的单文档格式，人性化可读性强，增强开发舒适性<br>
- [x] 数据驱动、组件式、响应式、声明式的开发过程<br>
- [x] 回归自然，三驾马车HTML/JS/CSS，写业务，完成<br>
- [x] 控制框架接口概念复杂度，保持简易性，杜绝过度开发<br>
- [x] 虚拟DOM及局部差异渲染<br>
- [x] 框架上集成样式的预处理及后处理操作，同一解决样式类名冲突问题<br>
- [x] 提供组件样式风格统一性方案<br>
- [x] 提供简便易用的前端路由方案<br>
- [x] 提供预渲染方案，用以灵活应付Loader或骨架屏等需求<br>
- [x] 提供源监视功能，源文件修改时自动编译，热更新浏览器<br>
- [x] 集成打包功能，按目标浏览器配置，直接按需打包成品<br>
</details>

<br>

## LIST
* `@rpose/cli`: [![NPM version](https://img.shields.io/npm/v/@rpose/cli.svg)](https://www.npmjs.com/package/@rpose/cli) https://github.com/gotoeasy/rpose/blob/master/cli/README.md

