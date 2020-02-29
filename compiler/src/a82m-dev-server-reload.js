const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const opn = require('opn');

const REBUILDING = 'rebuilding...';

// -----------------------------------------------------------------------
// 某日，browser-sync启动及刷新竟然要数分钟
// 原因或是众所周知的网络问题，或是不得而知的版本依赖问题
// 总之，无心花精力细查解决它，不得已先写个简陋实现，毕竟需求非常简单
//
// 此服务器只在watch模式下才开启
//
// 1）以dist目录为根目录建立服务器，处理响应文件请求
// 2）服务器添加文件是否变更的查询接口
// 3）html文件请求做特殊处理，注入客户端脚本，脚本中包含页面id和哈希码
// 4）客户端脚本每隔1秒请求服务器查询当前页是否有变更，有改变则刷新
// 5）服务器启动后，间隔一秒看有无请求，没有则打开浏览器访问，避免开一堆窗口
// -----------------------------------------------------------------------
bus.on('热刷新服务器', function (hasQuery){

    return function(){
        let env = bus.at('编译环境');
        if ( !env.watch ) return;

        let port = env.port ? (!/^\d+$/.test(env.port) ? randomNum(3000, 9999) : env.port) : 3700;
        createHttpServer(env.path.build_dist, port);
    }

    // 生成从minNum到maxNum的随机数
    function randomNum(minNum=3000, maxNum=9999) {
        return parseInt(Math.random() * ( maxNum - minNum + 1 ) + minNum, 10);
    }

    // 查询
    function queryHandle(req, res, oUrl){
        hasQuery = true;
        let env = bus.at('编译环境');
        let htmlpage = oUrl.query.split('&')[0].split('=')[1];
        let srcFile = File.resolve(env.path.src, htmlpage.substring(0, htmlpage.length-5) + '.rpose');


        let hashcode = '';
        if ( File.existsFile(srcFile) ) {
            let context = bus.at('组件编译缓存', srcFile);
            if ( context ) {
                hashcode = context.result.hashcode || REBUILDING;                               // 如果已经编译成功就会有值，否则可能是编译失败，或者是正编译中
            }else{
                hashcode = REBUILDING;                                                          // 返回'rebuilding...'状态，前端自行判断数次后按错误处理
            }
        }else{
            hashcode = '404';                                                                   // 源码文件不存在，显示404
        }

        res.writeHead(200);
        res.end(hashcode);                                                                      // 未成功编译时，返回空白串
    }

    // html注入脚本
    function htmlHandle(req, res, oUrl, htmlfile){

        let env = bus.at('编译环境');
        let srcFile = File.resolve(env.path.src, htmlfile.substring(env.path.build_dist.length+1, htmlfile.length-5) + '.rpose');
        let htmlpage = htmlfile.substring(env.path.build_dist.length+1);

        let html, hashcode = '';
        if ( File.existsFile(srcFile) ) {

            let context = bus.at('组件编译缓存', srcFile);
            if ( context ) {
                hashcode = context.result.hashcode || '';                                       // 如果已经编译成功就会有值，否则是正编译中
            }

            if ( !hashcode ) {
                // 当前不是编译成功状态，都显示500编译失败
                html = `
                    <!doctype html>
                    <html lang="en">
                        <head>
                        <title>500</title>
                        </head>
                    <body>
                        <pre style="background:#333;color:#ddd;padding:20px;font-size:24px;">500 Compile Failed</pre>
                    </body>
                    </html>
                    `;
                hashcode = '500';
            }else{
                html = File.read(htmlfile);
            }

        }else{
            // 源码文件不存在则404
            html = `
                <!doctype html>
                <html lang="en">
                    <head>
                    <title>404</title>
                    </head>
                <body>
                    <pre style="background:#943E03;color:#fff;padding:20px;font-size:24px;">404 Not Found</pre>
                </body>
                </html>
                `;
            hashcode = '404';
        }

        let script = `
        <script>
            var _times_ = 0;
            function refresh() {
                let url = '/query?page=${htmlpage}&t=' + new Date().getTime();
                ajaxAsync(url, function(rs){
                    if ( rs !== '${hashcode}' ) {
                        if ( rs === '${REBUILDING}' ) {
                            _times_++;
                            _times_ >= 5 ? location.reload() : setTimeout(refresh, 1000);
                        }else{
                            location.reload();
                        }
                    }else{
                        _times_ = 0;
                        setTimeout(refresh, 1000);
                    }
                }, function(err){
                    _times_ = 0;
                    setTimeout(refresh, 1000);
                });
            }

            function ajaxAsync(url, fnCallback, fnError) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function (xxx, eee) {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        fnCallback(xhr.responseText);
                    }
                };
                xhr.onerror = fnError;
                xhr.open("GET", url, true);
                xhr.send();
            }

            setTimeout(refresh, 3000);
        </script>`;


        html = html.replace(/<head>/i, '<head>' + script);                                      // 极简实现，注入脚本，定时轮询服务端
        res.writeHead(200, {'Content-Type': 'text/html;charset=UFT8'});                         // 即使404请求，也是被当正常注入返回
        res.end(html);
    }


    // 创建服务器
    function createHttpServer(www, port){

        let server = http.createServer(function (req, res) {
            let oUrl = url.parse(req.url);

           if ( /^\/query$/i.test(oUrl.pathname) ) {
                queryHandle(req, res, oUrl);                                                    // 查询页面哈希码
                return;
            }

            let reqfile = path.join(www, oUrl.pathname).replace(/\\/g, '/');
            if ( File.existsDir(reqfile) ) {
                reqfile = File.resolve(reqfile, 'index.html');                                  // 默认访问目录下的index.html
            }

            if ( /\.html$/i.test(reqfile) ) {
                htmlHandle(req, res, oUrl, reqfile);                                            // 拦截注入脚本后返回
                return;
            }


            if ( File.existsFile(reqfile) ) {
                if (/\.css$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "text/css;charset=UFT8" });            // 避免浏览器控制台警告
                } else if (/\.js$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/javascript;charset=UFT8" });
                } else if (/\.json$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/json;charset=UFT8" });
                } else if (/\.jsonp$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/jsonp;charset=UFT8" });
                } else if (/\.svg$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/svg+xml;charset=UFT8" });
                } else if (/\.svgz$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/svg+xml-compressed;charset=UFT8" });
                } else if (/\.jpg$/i.test(reqfile) || /\.jpeg$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/jpeg" });
                } else if (/\.gif$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/gif" });
                } else if (/\.bmp$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/bmp" });
                } else if (/\.png$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "image/png" });
                } else if (/\.pdf$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/pdf" });
                } else if (/\.xml$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "text/xml;charset=UFT8" });
                } else if (/\.dtd$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "text/xml-dtd;charset=UFT8" });
                } else if (/\.zip$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/zip" });
                } else if (/\.gzip$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/gzip" });
                } else if (/\.xls$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/vnd.ms-excel" });
                } else if (/\.xlsx$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                } else if (/\.doc$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/msword" });
                } else if (/\.docx$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
                } else if (/\.ppt$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/vnd.ms-powerpoint" });
                } else if (/\.pptx$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
                } else if (/\.dll$/i.test(reqfile) || /\.exe$/i.test(reqfile)) {
                    res.writeHead(200, { "Content-Type": "application/x-msdownload" });
                } else {
                    res.writeHead(200);
                }
                fs.createReadStream(reqfile).pipe(res);                                         // 非html文件，直接输出文件流
            }else{
                if ( /favicon\.ico$/i.test(reqfile) ) {
                    res.writeHead(200);                                                         // 避免浏览器控制台警告
                    res.end(null);
                }else{
                    res.writeHead(404);
                    res.end('404 Not Found');                                                   // 文件找不到
                }
            }

        });

        server.listen(port);
        let hostUrl = 'http://localhost:' + port;
        console.log('-------------------------------------------');
        console.log(` server ready ...... ${hostUrl}`);
        console.log('-------------------------------------------');

        setTimeout(() => {
            !hasQuery && opn(hostUrl);                                                          // 等1秒钟还是没有请求的话，新开浏览器
        }, 1000);
    }


}());

