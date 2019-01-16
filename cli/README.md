# `@rpose/cli`
<br>
<br>

[![NPM version](https://img.shields.io/npm/v/@rpose/cli.svg)](https://www.npmjs.com/package/@rpose/cli)
[![License](https://img.shields.io/badge/License-Apache%202-brightgreen.svg)](http://www.apache.org/licenses/LICENSE-2.0)
<br>
<br>

## Install
```
npm i -g @rpose/cli
```

## Create
```
rpose create my-project
```

## Watch
```
cd my-project
rpose watch
```

## Build
```
cd my-project
rpose build -c -r
```

## Setting
use file `.browserslistrc` to config target browsers
```
>= 2%
>= 1% in cn
not dead
ie 11
```

use file `rpose.config.btf` to config rpose project
```
[path] // config project path info
src                 : src
build               : build

[theme] // theme npm package
@gotoeasy/theme

[prerender] // prerender npm package
@gotoeasy/pre-render
```


<br>

## `Links`
* `gotoeasy` https://gotoeasy.github.io
* `rpose` https://github.com/gotoeasy/rpose
* `npm-packages` https://github.com/gotoeasy/npm-packages

