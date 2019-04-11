console.time("load");

(() => {
    const File = require("@gotoeasy/file");
    const Btf = require("@gotoeasy/btf");
    const bus = require("@gotoeasy/bus");
    const util = require("@gotoeasy/util");
    const Err = require("@gotoeasy/err");
    const npm = require("@gotoeasy/npm");
    const path = require("path");
    bus.on("编译环境", function(result) {
        return function(opts) {
            if (result) {
                return result;
            }
            let packagefile = File.resolve(__dirname, "./package.json");
            !File.existsFile(packagefile) && (packagefile = File.resolve(__dirname, "../package.json"));
            let compilerVersion = JSON.parse(File.read(packagefile)).version;
            let defaultFile = File.path(packagefile) + "/default.rpose.config.btf";
            result = parseRposeConfigBtf("rpose.config.btf", defaultFile, opts);
            result.clean = !!opts.clean;
            result.release = !!opts.release;
            result.debug = !!opts.debug;
            result.nocache = !!opts.nocache;
            result.build = !!opts.build;
            result.watch = !!opts.watch;
            result.compilerVersion = compilerVersion;
            if (result.path.cache) {
                result.path.cache = File.resolve(result.path.cwd, result.path.cache);
            }
            return result;
        };
    }());
    function parseRposeConfigBtf(file, defaultFile, opts) {
        let cwd = opts.cwd || process.cwd();
        cwd = path.resolve(cwd).replace(/\\/g, "/");
        if (!File.existsDir(cwd)) {
            throw new Err("invalid path of cwd: " + opts.cwd);
        }
        let root = cwd;
        file = File.resolve(root, file);
        if (!File.exists(file)) {
            file = defaultFile;
        }
        let result = {
            path: {}
        };
        let btf = new Btf(file);
        let mapPath = btf.getMap("path");
        mapPath.forEach((v, k) => mapPath.set(k, v.split("//")[0].trim()));
        let mapImport = btf.getMap("taglib");
        let imports = {};
        mapImport.forEach((v, k) => imports[k] = v.split("//")[0].trim());
        result.imports = imports;
        result.path.cwd = cwd;
        result.path.root = root;
        result.path.src = root + "/src";
        result.path.build = getConfPath(root, mapPath, "build", "build");
        result.path.build_temp = result.path.build + "/temp";
        result.path.build_dist = result.path.build + "/dist";
        result.path.build_dist_images = mapPath.get("build_dist_images") || "images";
        result.path.cache = mapPath.get("cache");
        result.theme = btf.getText("theme") == null || !btf.getText("theme").trim() ? "@gotoeasy/theme" : btf.getText("theme").trim();
        result.prerender = btf.getText("prerender") == null || !btf.getText("prerender").trim() ? "@gotoeasy/pre-render" : btf.getText("prerender").trim();
        autoInstallLocalModules(result.theme, result.prerender);
        return result;
    }
    function getConfPath(root, map, key, defaultValue) {
        if (!map.get(key)) {
            return root + "/" + defaultValue.split("/").filter(v => !!v).join("/");
        }
        return root + "/" + map.get(key).split("/").filter(v => !!v).join("/");
    }
    function autoInstallLocalModules(...names) {
        let ignores = [ "@gotoeasy/theme", "@gotoeasy/pre-render" ];
        let node_modules = [ ...require("find-node-modules")({
            cwd: __dirname,
            relative: false
        }), ...require("find-node-modules")({
            cwd: process.cwd(),
            relative: false
        }) ];
        for (let i = 0, name; name = names[i++]; ) {
            if (ignores.includes(name)) {
                continue;
            }
            let isInstalled = false;
            for (let j = 0, dir; dir = node_modules[j++]; ) {
                if (File.isDirectoryExists(File.resolve(dir, name))) {
                    isInstalled = true;
                    continue;
                }
            }
            !isInstalled && npm.install(name);
        }
    }
})();

(() => {
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");
    bus.on("clean", function() {
        return () => {
            try {
                let env = bus.at("编译环境");
                if (env.clean) {
                    File.remove(env.path.build);
                    console.info("clean:", env.path.build);
                }
                File.mkdir(env.path.build_dist);
            } catch (e) {
                throw Err.cat(" clean failed", e);
            }
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const cache = require("@gotoeasy/cache");
    const csslibify = require("csslibify");
    (function(result = {}, oCache, resourcesPaths) {
        bus.on("组件编译缓存", function(file, context) {
            if (context) {
                result[file] = context;
                return context;
            }
            if (context === undefined) {
                return result[file];
            }
            delete result[file];
        });
        bus.on("缓存", function() {
            if (!oCache) {
                let env = bus.at("编译环境");
                oCache = cache({
                    name: "rpose-compiler-" + env.compilerVersion,
                    path: env.path.cache
                });
            }
            return oCache;
        });
        bus.on("缓存资源目录数组", function() {
            if (!resourcesPaths) {
                resourcesPaths = [ bus.at("缓存").path + "/resources", csslibify().basePath ];
            }
            return resourcesPaths;
        });
    })();
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    (function(oFiles, oTagFiles = {}) {
        function getSrcFileObject(file, tag) {
            let text = File.read(file);
            let hashcode = hash(text);
            return {
                file: file,
                text: text,
                hashcode: hashcode,
                tag: tag
            };
        }
        function getRefPages(tag) {
            if (!tag) {
                return [];
            }
            let refFiles = [];
            for (let file in oFiles) {
                let context = bus.at("组件编译缓存", file);
                if (context) {
                    let allreferences = context.result.allreferences || [];
                    allreferences.includes(tag) && refFiles.push(file);
                }
            }
            return refFiles;
        }
        bus.on("标签项目源文件", function(tag) {
            let ary = oTagFiles[tag];
            if (ary && ary.length) {
                return ary[0];
            }
        });
        bus.on("源文件对象清单", function() {
            if (!oFiles) {
                oFiles = {};
                let env = bus.at("编译环境");
                let files = File.files(env.path.src, "**.rpose");
                files.forEach(file => {
                    let tag = getTagOfSrcFile(file);
                    if (tag) {
                        let ary = oTagFiles[tag] = oTagFiles[tag] || [];
                        ary.push(file);
                        if (ary.length === 1) {
                            oFiles[file] = getSrcFileObject(file, tag);
                        }
                    } else {
                        console.error("[src-file-manager]", "ignore invalid source file ..........", file);
                    }
                });
                for (let tag in oTagFiles) {
                    let ary = oTagFiles[tag];
                    if (ary.length > 1) {
                        console.error("[src-file-manager]", "duplicate tag name:", tag);
                        console.error(ary);
                        for (let i = 1, file; file = ary[i++]; ) {
                            console.error("  ignore ..........", file);
                        }
                    }
                }
            }
            return oFiles;
        });
        bus.on("源文件添加", function(oFile) {
            let tag = getTagOfSrcFile(oFile.file);
            if (!tag) {
                return console.error("[src-file-manager]", "invalid source file name ..........", oFile.file);
            }
            let ary = oTagFiles[tag] = oTagFiles[tag] || [];
            ary.push(oFile.file);
            if (ary.length > 1) {
                console.error("[src-file-manager]", "duplicate tag name:", tag);
                console.error(ary);
                console.error("  ignore ..........", oFile.file);
                return;
            }
            oFiles[oFile.file] = getSrcFileObject(oFile.file, tag);
            return bus.at("全部编译");
        });
        bus.on("源文件修改", function(oFileIn) {
            let tag = getTagOfSrcFile(oFileIn.file);
            let refFiles = getRefPages(tag);
            let oFile = oFiles[oFileIn.file];
            if (!tag || !oFile) {
                delete oFiles[oFileIn.file];
                return;
            }
            if (oFile.hashcode === oFileIn.hashcode) {
                return;
            }
            oFiles[oFile.file] = Object.assign({}, oFileIn);
            refFiles.forEach(file => {
                bus.at("组件编译缓存", file, false);
                writeInfoPage(file, `rebuilding for component [${tag}] changed`);
            });
            bus.at("组件编译缓存", oFile.file, false);
            return bus.at("全部编译");
        });
        bus.on("源文件删除", function(file) {
            let tag = getTagOfSrcFile(file);
            let refFiles = getRefPages(tag);
            let oFile = oFiles[file];
            let ary = oTagFiles[tag];
            delete oFiles[file];
            if (ary) {
                let idx = ary.indexOf(file);
                if (idx > 0) {
                    return ary.splice(idx, 1);
                } else if (idx === 0) {
                    ary.splice(idx, 1);
                    if (ary.length) {
                        oFiles[ary[0]] = getSrcFileObject(ary[0], tag);
                        bus.at("组件编译缓存", ary[0], false);
                    } else {
                        delete oTagFiles[tag];
                    }
                }
            }
            if (!tag || !oFile) {
                return;
            }
            refFiles.forEach(file => {
                bus.at("组件编译缓存", file, false);
                writeInfoPage(file, `rebuilding for component [${tag}] removed`);
            });
            bus.at("组件编译缓存", oFile.file, false);
            return bus.at("全部编译");
        });
    })();
    function getTagOfSrcFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return;
        }
        return name.toLowerCase();
    }
    function writeInfoPage(file, msg) {
        let fileHtml = bus.at("页面目标HTML文件名", file);
        let fileCss = bus.at("页面目标CSS文件名", file);
        let fileJs = bus.at("页面目标JS文件名", file);
        if (File.existsFile(fileHtml)) {
            File.write(fileHtml, syncHtml(msg));
            File.remove(fileCss);
            File.remove(fileJs);
        }
    }
    function syncHtml(msg = "") {
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>Page build failed or src file removed<p/>\n        <pre style="background:#333;color:#ddd;padding:10px;">${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n    </body>`;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    const hash = require("@gotoeasy/hash");
    const chokidar = require("chokidar");
    bus.on("文件监视", function(oHash = {}) {
        return function() {
            let env = bus.at("编译环境");
            if (!env.watch) {
                return;
            }
            bus.at("热刷新服务器");
            let ready, watcher = chokidar.watch(env.path.src);
            watcher.on("add", async file => {
                if (ready && (file = file.replace(/\\/g, "/")) && /\.rpose$/i.test(file)) {
                    if (isValidRposeFile(file)) {
                        console.info("add ......", file);
                        let text = File.read(file);
                        let hashcode = hash(text);
                        let oFile = {
                            file: file,
                            text: text,
                            hashcode: hashcode
                        };
                        oHash[file] = oFile;
                        await busAt("源文件添加", oFile);
                    } else {
                        console.info("ignored ...... add", file);
                    }
                }
            }).on("change", async file => {
                if (ready && (file = file.replace(/\\/g, "/")) && /\.rpose$/i.test(file)) {
                    if (isValidRposeFile(file)) {
                        let text = File.read(file);
                        let hashcode = hash(text);
                        if (!oHash[file] || oHash[file].hashcode !== hashcode) {
                            console.info("change ......", file);
                            let oFile = {
                                file: file,
                                text: text,
                                hashcode: hashcode
                            };
                            oHash[file] = oFile;
                            await busAt("源文件修改", oFile);
                        }
                    } else {
                        console.info("ignored ...... change", file);
                    }
                }
            }).on("unlink", async file => {
                if (ready && (file = file.replace(/\\/g, "/")) && /\.rpose$/i.test(file)) {
                    if (isValidRposeFile(file)) {
                        console.info("del ......", file);
                        delete oHash[file];
                        await busAt("源文件删除", file);
                    } else {
                        console.info("ignored ...... del", file);
                    }
                }
            }).on("ready", () => {
                ready = true;
            });
        };
    }());
    async function busAt(name, ofile) {
        console.time("build");
        let promises = bus.at(name, ofile);
        if (promises) {
            for (let i = 0, p; p = promises[i++]; ) {
                try {
                    await p;
                } catch (e) {
                    console.error(Err.cat("build failed", e).toString());
                }
            }
        }
        console.timeEnd("build");
    }
    function isValidRposeFile(file) {
        let name = File.name(file);
        if (/[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
            return false;
        }
        return true;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const os = require("@gotoeasy/os");
    const File = require("@gotoeasy/file");
    bus.on("全部编译", function(bs) {
        return function() {
            let oFiles = bus.at("源文件对象清单");
            let env = bus.at("编译环境");
            bus.at("项目配置处理", env.path.root + "rpose.config.btf");
            let promises = [];
            let stime, time;
            for (let key in oFiles) {
                stime = new Date().getTime();
                let context = bus.at("编译组件", oFiles[key]);
                context.result.browserifyJs && promises.push(context.result.browserifyJs);
                time = new Date().getTime() - stime;
                if (time > 100) {
                    console.info("[compile] " + time + "ms -", key.replace(env.path.src + "/", ""));
                }
            }
            return promises;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译组件", function() {
        return function(infile) {
            let oFile;
            if (infile.file) {
                oFile = infile;
            } else {
                let file, text, hashcode;
                file = bus.at("标签源文件", infile);
                if (!File.existsFile(file)) {
                    throw new Err(`file not found: ${file} (${infile})`);
                }
                text = File.read(file);
                hashcode = hash(text);
                oFile = {
                    file: file,
                    text: text,
                    hashcode: hashcode
                };
            }
            let env = bus.at("编译环境");
            let context = bus.at("组件编译缓存", oFile.file);
            if (context && context.input.hashcode !== oFile.hashcode) {
                context = bus.at("组件编译缓存", oFile.file, false);
            }
            if (!context) {
                let plugins = bus.on("编译插件");
                return postobject(plugins).process({
                    ...oFile
                }, {
                    log: env.debug
                });
            }
            return context;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const fs = require("fs");
    const url = require("url");
    const path = require("path");
    const http = require("http");
    const opn = require("opn");
    const REBUILDING = "rebuilding...";
    bus.on("热刷新服务器", function(hasQuery) {
        return function() {
            let env = bus.at("编译环境");
            if (!env.watch) {
                return;
            }
            createHttpServer(env.path.build_dist, 3700);
        };
        function queryHandle(req, res, oUrl) {
            hasQuery = true;
            let env = bus.at("编译环境");
            let htmlpage = oUrl.query.split("&")[0].split("=")[1];
            let srcFile = File.resolve(env.path.src, htmlpage.substring(0, htmlpage.length - 5) + ".rpose");
            let hashcode = "";
            if (File.existsFile(srcFile)) {
                let context = bus.at("组件编译缓存", srcFile);
                if (context) {
                    hashcode = context.result.hashcode || "";
                }
                if (!hashcode) {
                    let fileHtml = bus.at("页面目标HTML文件名", srcFile);
                    let fileCss = bus.at("页面目标CSS文件名", srcFile);
                    let fileJs = bus.at("页面目标JS文件名", srcFile);
                    if (File.existsFile(fileHtml)) {
                        let html = File.read(fileHtml);
                        if (html.indexOf("<body>Page build failed or src file removed<p/>") > 0) {
                            hashcode = REBUILDING;
                        } else {
                            let css = File.existsFile(fileCss) ? File.read(fileCss) : "";
                            let js = File.existsFile(fileJs) ? File.read(fileJs) : "";
                            hashcode = hash(html + css + js);
                        }
                    }
                }
            }
            res.writeHead(200);
            res.end(hashcode);
        }
        function htmlHandle(req, res, oUrl, htmlfile) {
            let env = bus.at("编译环境");
            let srcFile = File.resolve(env.path.src, htmlfile.substring(env.path.build_dist.length + 1, htmlfile.length - 5) + ".rpose");
            let context = bus.at("组件编译缓存", srcFile);
            let hashcode = context ? context.result.hashcode || "" : null;
            if (!hashcode) {
                let fileHtml = bus.at("页面目标HTML文件名", srcFile);
                let fileCss = bus.at("页面目标CSS文件名", srcFile);
                let fileJs = bus.at("页面目标JS文件名", srcFile);
                if (File.existsFile(fileHtml)) {
                    let html = File.read(fileHtml);
                    let css = File.existsFile(fileCss) ? File.read(fileCss) : "";
                    let js = File.existsFile(fileJs) ? File.read(fileJs) : "";
                    hashcode = hash(html + css + js);
                }
            }
            let htmlpage = htmlfile.substring(env.path.build_dist.length + 1);
            let script = `\n        <script>\n            var _times_ = 0;\n            function refresh() {\n                let url = '/query?page=${htmlpage}&t=' + new Date().getTime();\n                ajaxAsync(url, function(rs){\n                    if ( rs !== '${hashcode}' ) {\n                        if ( rs === '${REBUILDING}' ) {\n                            _times_++;\n                            _times_ >= 5 ? location.reload() : setTimeout(refresh, 1000);\n                        }else{\n                            location.reload();\n                        }\n                    }else{\n                        _times_ = 0;\n                        setTimeout(refresh, 1000);\n                    }\n                }, function(err){\n                    _times_ = 0;\n                    setTimeout(refresh, 1000);\n                });\n            }\n\n            function ajaxAsync(url, fnCallback, fnError) {\n                var xhr = new XMLHttpRequest();\n                xhr.onreadystatechange = function (xxx, eee) {\n                    if (xhr.readyState === 4 && xhr.status === 200) {\n                        fnCallback(xhr.responseText);\n                    }\n                };\n                xhr.onerror = fnError;\n                xhr.open("GET", url, true);\n                xhr.send();\n            }\n\n            setTimeout(refresh, 3000);\n        <\/script>`;
            let html = File.read(htmlfile).replace(/<head>/i, "<head>" + script);
            res.writeHead(200, {
                "Content-Type": "text/html;charset=UFT8"
            });
            res.end(html);
        }
        function createHttpServer(www, port) {
            let server = http.createServer(function(req, res) {
                let oUrl = url.parse(req.url);
                if (/^\/query$/i.test(oUrl.pathname)) {
                    queryHandle(req, res, oUrl);
                    return;
                }
                let reqfile = path.join(www, oUrl.pathname).replace(/\\/g, "/");
                if (File.existsDir(reqfile)) {
                    reqfile = File.resolve(reqfile, "index.html");
                }
                if (/\.html$/i.test(reqfile)) {
                    if (File.existsFile(reqfile)) {
                        htmlHandle(req, res, oUrl, reqfile);
                    } else {
                        res.writeHead(404);
                        res.end("404 Not Found");
                    }
                    return;
                }
                if (File.existsFile(reqfile)) {
                    if (/\.css$/i.test(reqfile)) {
                        res.writeHead(200, {
                            "Content-Type": "text/css;charset=UFT8"
                        });
                    } else {
                        res.writeHead(200);
                    }
                    fs.createReadStream(reqfile).pipe(res);
                } else {
                    if (/favicon\.ico$/i.test(reqfile)) {
                        res.writeHead(200);
                        res.end(null);
                    } else {
                        res.writeHead(404);
                        res.end("404 Not Found");
                    }
                }
            });
            server.listen(port);
            let hostUrl = "http://localhost:" + port;
            console.log("-------------------------------------------");
            console.log(` server ready ...... ${hostUrl}`);
            console.log("-------------------------------------------");
            setTimeout(() => {
                !hasQuery && opn(hostUrl);
            }, 1e3);
        }
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("b00p-log", function(root, context) {});
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("b01p-init-context", function(root, context) {
            context.input = {};
            context.doc = {};
            context.style = {};
            context.script = {};
            context.keyCounter = 1;
            context.result = {};
            root.walk((node, object) => {
                context.input.file = object.file;
                context.input.text = object.text;
                context.input.hashcode = object.hashcode;
            }, {
                readonly: true
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("项目配置文件解析", function() {
        return function(text, keepLoc = true) {
            let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
            let lines = text.split(LF);
            let lineCounts = lines.map(v => v.length + LF.length);
            let nodes = [];
            parse(nodes, lines, lineCounts, LF);
            nodes.forEach(block => {
                if (block.buf.length) {
                    let type = "ProjectBtfBlockText";
                    let value = block.buf.join(LF);
                    let line = block.name.loc.start.line + 1;
                    let column = 1;
                    let pos = sumLineCount(lineCounts, line - 1);
                    let start = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    line = block.name.loc.start.line + block.buf.length;
                    column = block.buf[block.buf.length - 1].length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column;
                    if (column === 1 && block.buf.length > 1) {
                        line--;
                        column = block.buf[block.buf.length - 2].length + 1;
                    }
                    end = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    block.text = {
                        type: type,
                        value: value,
                        loc: {
                            start: start,
                            end: end
                        }
                    };
                }
                delete block.buf;
                if (keepLoc === false) {
                    delete block.name.loc;
                    block.comment !== undefined && delete block.comment.loc;
                    block.text !== undefined && delete block.text.loc;
                }
            });
            return {
                nodes: nodes
            };
        };
    }());
    function parse(blocks, lines, lineCounts, lf) {
        let sLine, block, oName, name, comment, value, blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];
            if (isBlockStart(sLine)) {
                block = {
                    type: "ProjectBtfBlock"
                };
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2);
                let line = i + 1;
                let column = 1;
                let pos = sumLineCount(lineCounts, line - 1);
                let start = {
                    line: line,
                    column: column,
                    pos: pos
                };
                column = oName.len + 3;
                pos += column - 1;
                end = {
                    line: line,
                    column: column,
                    pos: pos
                };
                block.name = {
                    type: "ProjectBtfBlockName",
                    value: oName.name,
                    loc: {
                        start: start,
                        end: end
                    }
                };
                if (comment) {
                    column = oName.len + 3;
                    start = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    column = sLine.length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column - 1;
                    end = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    block.comment = {
                        type: "ProjectBtfBlockComment",
                        value: comment,
                        loc: {
                            start: start,
                            end: end
                        }
                    };
                }
                block.buf = [];
                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                return;
            } else {
                if (blockStart) {
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+\---------/.test(sLine) || /^\\+\=========/.test(sLine))) {
                        buf.push(sLine.substring(1));
                    } else {
                        buf.push(sLine);
                    }
                } else {}
            }
        }
    }
    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }
    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }
    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }
    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                name = name.replace(/\\\]/g, "]");
                return {
                    name: name,
                    len: len
                };
            }
        }
        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        name = name.replace(/\\\]/g, "]");
        return {
            name: name,
            len: len
        };
    }
    function sumLineCount(lineCounts, lineNo) {
        let rs = 0;
        for (let i = 0; i < lineNo; i++) {
            rs += lineCounts[i];
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const csslibify = require("csslibify");
    bus.on("样式库", function(rs = {}) {
        return function(defCsslib) {
            let match;
            let name, pkg, filters = [];
            if (match = defCsslib.match(/^(.*?)=(.*?):(.*)$/)) {
                name = match[1].trim();
                pkg = match[2].trim();
                cssfilter = match[3];
                cssfilter.replace(/;/g, ",").split(",").forEach(filter => {
                    filter = filter.trim();
                    filter && filters.push(filter);
                });
            } else if (match = defCsslib.match(/^(.*?)=(.*)$/)) {
                name = match[1].trim();
                pkg = match[2].trim();
                filters.push("**.min.css");
            } else if (match = defCsslib.match(/^(.*?):(.*)$/)) {
                name = "*";
                pkg = match[1].trim();
                cssfilter = match[2];
                cssfilter.replace(/;/g, ",").split(",").forEach(filter => {
                    filter = filter.trim();
                    filter && filters.push(filter);
                });
            } else {
                name = "*";
                pkg = defCsslib.trim();
                filters.push("**.min.css");
            }
            pkg.lastIndexOf("@") > 1 && (pkg = pkg.substring(0, pkg.lastIndexOf("@")));
            let dir, env = bus.at("编译环境");
            if (pkg.startsWith("$")) {
                dir = env.path.root + "/" + pkg;
                !File.existsDir(dir) && (dir = env.path.root + "/" + pkg.substring(1));
            }
            (!dir || !File.existsDir(dir)) && (dir = getNodeModulePath(pkg));
            let cssfiles = File.files(dir, ...filters);
            (!name || name === "*") && (pkg = "");
            let libid = hash(JSON.stringify([ pkg, cssfiles ]));
            let csslib = csslibify(pkg, name, libid);
            !csslib._imported.length && cssfiles.forEach(cssfile => csslib.imp(cssfile));
            return csslib;
        };
    }());
    function getNodeModulePath(npmpkg) {
        bus.at("自动安装", npmpkg);
        let node_modules = [ ...require("find-node-modules")({
            cwd: process.cwd(),
            relative: false
        }), ...require("find-node-modules")({
            cwd: __dirname,
            relative: false
        }) ];
        for (let i = 0, modulepath, dir; modulepath = node_modules[i++]; ) {
            dir = File.resolve(modulepath, npmpkg);
            if (File.existsDir(dir)) {
                return dir;
            }
        }
        throw new Error("path not found of npm package: " + npmpkg);
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("解析[csslib]", function() {
        return function parseCsslib(csslib, context, loc) {
            let rs = {};
            let lines = (csslib == null ? "" : csslib.trim()).split("\n");
            for (let i = 0, line; i < lines.length; i++) {
                line = lines[i];
                let key, value, idx = line.indexOf("=");
                if (idx < 0) {
                    continue;
                }
                key = line.substring(0, idx).trim();
                value = line.substring(idx + 1).trim();
                idx = value.lastIndexOf("//");
                idx >= 0 && (value = value.substring(0, idx).trim());
                if (!key) {
                    throw new Err("use * as empty csslib name. etc. * = " + value, {
                        file: context.input.file,
                        text: context.input.text,
                        line: loc.start.line + i,
                        column: 1
                    });
                }
                if (rs[key]) {
                    throw new Err("duplicate csslib name: " + key, {
                        file: context.input.file,
                        text: context.input.text,
                        line: loc.start.line + i,
                        column: 1
                    });
                }
                rs[key] = value;
            }
            return rs;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const File = require("@gotoeasy/file");
    const Btf = require("@gotoeasy/btf");
    bus.on("标签库定义", function(rs = {}, rsPkg = {}) {
        let stack = [];
        bus.on("标签库引用", function(tag, fileOrRoot) {
            let searchPkg = bus.at("文件所在模块", fileOrRoot);
            let name, idx1 = tag.indexOf("="), idx2 = tag.indexOf(":");
            if (idx1 < 0 && idx2 < 0) {
                name = tag.trim();
            } else if (idx2 > 0) {
                name = tag.substring(idx2 + 1).trim();
            } else {
                name = tag.substring(0, idx1).trim();
            }
            let key = searchPkg + ":" + name;
            return rs[key];
        });
        return function(defTaglib, file) {
            let oTaglib = bus.at("normalize-taglib", defTaglib);
            initPkgDefaultTag(oTaglib.pkg);
            let askey, tagkey, oPkg, searchPkg = bus.at("文件所在模块", file);
            askey = searchPkg + ":" + oTaglib.astag;
            tagkey = oTaglib.pkg + ":" + oTaglib.tag;
            if (rs[tagkey]) {
                rs[askey] = rs[tagkey];
                stack = [];
                return rs;
            }
            stack.push(`[${searchPkg}] ${oTaglib.taglib}`);
            let pkgfile;
            try {
                pkgfile = require.resolve(oTaglib.pkg + "/package.json", {
                    paths: [ bus.at("编译环境").path.root, __dirname ]
                });
            } catch (e) {
                stack.unshift(e.message);
                let msg = stack.join("\n => ");
                stack = [];
                throw new Error(msg);
            }
            let configfile = File.path(pkgfile) + "/rpose.config.btf";
            if (!File.existsFile(configfile)) {
                stack.unshift(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`);
                let msg = stack.join("\n => ");
                stack = [];
                throw new Error(msg);
            }
            let btf = new Btf(configfile);
            let oTaglibKv, taglibBlockText = btf.getText("taglib");
            try {
                oTaglibKv = bus.at("解析[taglib]", taglibBlockText, {
                    input: {
                        file: configfile
                    }
                });
            } catch (e) {
                stack.push(`[${oTaglib.pkg}] ${oTaglib.pkg}:${oTaglib.tag}`);
                stack.push(configfile);
                stack.unshift(e.message);
                let msg = stack.join("\n => ");
                stack = [];
                throw new Error(msg);
            }
            let oConfTaglib = oTaglibKv[oTaglib.tag];
            if (!oConfTaglib) {
                stack.push(configfile);
                stack.unshift(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`);
                let msg = stack.join("\n => ");
                stack = [];
                throw new Error(msg);
            }
            bus.at("自动安装", oConfTaglib.pkg);
            return bus.at("标签库定义", oConfTaglib.taglib, configfile);
        };
        function initPkgDefaultTag(pkg) {
            if (!rsPkg[pkg]) {
                let oPkg = bus.at("模块组件信息", pkg);
                for (let i = 0, file; file = oPkg.files[i++]; ) {
                    rs[oPkg.name + ":" + File.name(file)] = file;
                }
                rsPkg[pkg] = true;
            }
        }
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("normalize-taglib", function() {
        return function normalizeTaglib(taglib, offset = 0) {
            let astag, pkg, tag, match;
            if (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) {
                astag = match[1];
                pkg = match[2];
                tag = match[3];
            } else if (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/)) {
                astag = match[1];
                pkg = match[2];
                tag = match[1];
            } else if (match = taglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/)) {
                astag = match[2];
                pkg = match[1];
                tag = match[2];
            } else {
                return null;
            }
            return {
                line: offset,
                astag: astag,
                pkg: pkg,
                tag: tag,
                taglib: astag + "=" + pkg + ":" + tag
            };
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("解析[taglib]", function() {
        return function parseTaglib(taglibBlockText, context, loc) {
            let rs = {};
            let lines = (taglibBlockText == null ? "" : taglibBlockText.trim()).split("\n");
            for (let i = 0, taglib, oTaglib, oPkg; i < lines.length; i++) {
                taglib = lines[i].split("//")[0].trim();
                if (!taglib) {
                    continue;
                }
                oTaglib = bus.at("normalize-taglib", taglib, i);
                if (!oTaglib) {
                    if (loc) {
                        throw new Err("invalid taglib: " + oTaglib.taglib, {
                            file: context.input.file,
                            text: context.input.text,
                            line: loc.start.line + i,
                            column: 1
                        });
                    }
                    throw new Err(`invalid taglib: ${taglib}`);
                }
                if (/^(if|for)$/i.test(oTaglib.astag)) {
                    if (loc) {
                        throw new Err("can not use buildin tag name: " + oTaglib.astag, {
                            file: context.input.file,
                            text: context.input.text,
                            line: loc.start.line + i,
                            column: 1
                        });
                    }
                    throw new Err("can not use buildin tag name: " + oTaglib.astag);
                }
                if (rs[oTaglib.astag]) {
                    if (loc) {
                        throw new Err("duplicate tag name: " + oTaglib.astag, {
                            file: context.input.file,
                            text: context.input.text,
                            line: loc.start.line + i,
                            column: 1
                        });
                    }
                    throw new Err("duplicate tag name: " + oTaglib.astag);
                }
                rs[oTaglib.astag] = oTaglib;
            }
            return rs;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("b95p-init-project-config", function(root, context) {
            context.project = bus.at("项目配置处理", context.input.file);
        });
    }());
    bus.on("项目配置处理", function(result = {}) {
        return function(srcFile) {
            let time, stime = new Date().getTime();
            let btfFile = srcFile.endsWith("/rpose.config.btf") ? srcFile : bus.at("文件所在项目配置文件", srcFile);
            if (result[btfFile]) {
                return result[btfFile];
            }
            if (!File.existsFile(btfFile)) {
                return {};
            }
            let plugins = bus.on("项目配置处理插件");
            let rs = postobject(plugins).process({
                file: btfFile
            });
            result[btfFile] = rs.result;
            time = new Date().getTime() - stime;
            time > 100 && console.debug("init-project-config:", time + "ms");
            return result[btfFile];
        };
    }());
    bus.on("项目配置处理插件", function() {
        return postobject.plugin("process-project-config-101", function(root, context) {
            context.input = {};
            context.result = {};
            root.walk((node, object) => {
                context.input.file = object.file;
                context.input.text = File.read(object.file);
                let blocks = bus.at("项目配置文件解析", context.input.text);
                let newNode = this.createNode(blocks);
                node.replaceWith(...newNode.nodes);
            });
            root.walk((node, object) => {
                if (!object.text || !object.text.value || !object.text.value.trim()) {
                    return node.remove();
                }
                let type = object.name.value;
                let value = object.text.value;
                let loc = object.text.loc;
                let oNode = this.createNode({
                    type: type,
                    value: value,
                    loc: loc
                });
                node.replaceWith(oNode);
            });
        });
    }());
    bus.on("项目配置处理插件", function() {
        return postobject.plugin("process-project-config-102", function(root, context) {
            let hashClassName = bus.on("哈希样式类名")[0];
            let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls);
            let opts = {
                rename: rename
            };
            let oKv;
            root.walk("csslib", (node, object) => {
                oKv = bus.at("解析[csslib]", object.value, context, object.loc);
                node.remove();
            });
            if (!oKv) {
                return;
            }
            let oCsslib = context.result.oCsslib = {};
            let oCsslibPkgs = context.result.oCsslibPkgs = context.result.oCsslibPkgs || {};
            for (let k in oKv) {
                oCsslib[k] = bus.at("样式库", `${k}=${oKv[k]}`);
                oCsslibPkgs[k] = oCsslib[k].pkg;
            }
        });
    }());
    bus.on("项目配置处理插件", function(addBuildinTaglib) {
        return postobject.plugin("process-project-config-103", function(root, context) {
            if (!addBuildinTaglib) {
                let pkg = "@rpose/buildin";
                if (!bus.at("自动安装", pkg)) {
                    throw new Error("package install failed: " + pkg);
                }
                bus.at("标签库定义", "@rpose/buildin:```", "");
                bus.at("标签库定义", "@rpose/buildin:router", "");
                bus.at("标签库定义", "@rpose/buildin:router-link", "");
                addBuildinTaglib = true;
            }
        });
    }());
    bus.on("项目配置处理插件", function(addBuildinTaglib) {
        return postobject.plugin("process-project-config-105", function(root, context) {
            let oKv, startLine;
            root.walk("taglib", (node, object) => {
                oKv = bus.at("解析[taglib]", object.value, context, object.loc);
                startLine = object.loc.start.line;
                node.remove();
            });
            context.result.oTaglib = oKv || {};
            if (!oKv) {
                return;
            }
            let mapPkg = new Map();
            for (let key in oKv) {
                mapPkg.set(oKv[key].pkg, oKv[key]);
            }
            mapPkg.forEach((oTag, pkg) => {
                if (!bus.at("自动安装", pkg)) {
                    throw new Err("package install failed: " + pkg, {
                        file: context.input.file,
                        text: context.input.text,
                        line: startLine + oTag.line,
                        column: 1
                    });
                }
            });
            for (let key in oKv) {
                try {
                    bus.at("标签库定义", oKv[key].taglib, context.input.file);
                } catch (e) {
                    throw new Err.cat(e, {
                        file: context.input.file,
                        text: context.input.text,
                        line: startLine + oKv[key].line,
                        column: 1
                    });
                }
            }
            if (!addBuildinTaglib) {
                pkg = "@rpose/buildin";
                if (!bus.at("自动安装", pkg)) {
                    throw new Error("package install failed: " + pkg);
                }
                bus.at("标签库定义", "@rpose/buildin:```", "");
                bus.at("标签库定义", "@rpose/buildin:router", "");
                bus.at("标签库定义", "@rpose/buildin:router-link", "");
                addBuildinTaglib = true;
            }
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("RPOSE源文件解析", function() {
        return function(text, keepLoc = true) {
            let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
            let lines = text.split(LF);
            let lineCounts = lines.map(v => v.length + LF.length);
            let nodes = [];
            parse(nodes, lines, lineCounts, LF);
            nodes.forEach(block => {
                if (block.buf.length) {
                    let type = "RposeBlockText";
                    let value = block.buf.join(LF);
                    let line = block.name.loc.start.line + 1;
                    let column = 1;
                    let pos = sumLineCount(lineCounts, line - 1);
                    let start = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    line = block.name.loc.start.line + block.buf.length;
                    column = block.buf[block.buf.length - 1].length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column;
                    if (column === 1 && block.buf.length > 1) {
                        line--;
                        column = block.buf[block.buf.length - 2].length + 1;
                    }
                    end = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    block.text = {
                        type: type,
                        value: value,
                        loc: {
                            start: start,
                            end: end
                        }
                    };
                }
                delete block.buf;
                if (keepLoc === false) {
                    delete block.name.loc;
                    block.comment !== undefined && delete block.comment.loc;
                    block.text !== undefined && delete block.text.loc;
                }
            });
            return {
                nodes: nodes
            };
        };
    }());
    function parse(blocks, lines, lineCounts, lf) {
        let sLine, block, oName, name, comment, value, blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];
            if (isBlockStart(sLine)) {
                block = {
                    type: "RposeBlock"
                };
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2);
                let line = i + 1;
                let column = 1;
                let pos = sumLineCount(lineCounts, line - 1);
                let start = {
                    line: line,
                    column: column,
                    pos: pos
                };
                column = oName.len + 3;
                pos += column - 1;
                end = {
                    line: line,
                    column: column,
                    pos: pos
                };
                block.name = {
                    type: "RposeBlockName",
                    value: oName.name,
                    loc: {
                        start: start,
                        end: end
                    }
                };
                if (comment) {
                    column = oName.len + 3;
                    start = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    column = sLine.length + 1;
                    pos = sumLineCount(lineCounts, line - 1) + column - 1;
                    end = {
                        line: line,
                        column: column,
                        pos: pos
                    };
                    block.comment = {
                        type: "RposeBlockComment",
                        value: comment,
                        loc: {
                            start: start,
                            end: end
                        }
                    };
                }
                block.buf = [];
                blocks.push(block);
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                return;
            } else {
                if (blockStart) {
                    let buf = blocks[blocks.length - 1].buf;
                    if (sLine.charAt(0) === "\\" && (/^\\+\[.*\]/.test(sLine) || /^\\+\---------/.test(sLine) || /^\\+\=========/.test(sLine))) {
                        buf.push(sLine.substring(1));
                    } else {
                        buf.push(sLine);
                    }
                } else {}
            }
        }
    }
    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }
    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }
    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }
    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                name = name.replace(/\\\]/g, "]");
                return {
                    name: name,
                    len: len
                };
            }
        }
        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        name = name.replace(/\\\]/g, "]");
        return {
            name: name,
            len: len
        };
    }
    function sumLineCount(lineCounts, lineNo) {
        let rs = 0;
        for (let i = 0; i < lineNo; i++) {
            rs += lineCounts[i];
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("c15p-parse-rpose-src-to-blocks", function(root, context) {
            let result = context.result;
            root.walk((node, object) => {
                result.tagpkg = bus.at("标签全名", object.file);
                let blocks = bus.at("RPOSE源文件解析", object.text);
                let newNode = this.createNode(blocks);
                node.replaceWith(...newNode.nodes);
                return false;
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("c25p-blocks-to-context-doc", function(root, context) {
            let doc = context.doc;
            root.walk("RposeBlock", (node, object) => {
                if (/^(api|options|state|mount)$/.test(object.name.value)) {
                    doc[object.name.value] = object.text ? object.text.value : "";
                    node.remove();
                }
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("c35p-normalize-context-doc", function(root, context) {
            let doc = context.doc;
            doc.api = parseBlockApi(doc.api);
            doc.mount && (doc.mount = doc.mount.trim());
        });
    }());
    function parseBlockApi(api) {
        let rs = {};
        let lines = (api == null ? "" : api.trim()).split("\n");
        lines.forEach(line => {
            let key, value, idx = line.indexOf("=");
            idx < 0 && (idx = line.indexOf(":"));
            if (idx < 0) {
                return;
            }
            key = line.substring(0, idx).trim();
            value = line.substring(idx + 1).trim();
            idx = value.lastIndexOf("//");
            idx >= 0 && (value = value.substring(0, idx).trim());
            if (/^option[\-]?keys$/i.test(key)) {
                key = "optionkeys";
                value = value.split(/[,;]/).map(v => v.trim());
            } else if (/^state[\-]?keys$/i.test(key)) {
                key = "statekeys";
                value = value.split(/[,;]/).map(v => v.trim());
            } else if (/^pre[\-]?render$/i.test(key)) {
                key = "prerender";
            }
            rs[key] = value;
        });
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("c45p-is-page", function(root, context) {
            context.result.isPage = context.doc.mount && !/\/components\//i.test(context.input.file) && !/\/node_modules\//i.test(context.input.file);
        });
    }());
})();

(() => {
    const Err = require("@gotoeasy/err");
    const bus = require("@gotoeasy/bus");
    const Btf = require("@gotoeasy/btf");
    const File = require("@gotoeasy/file");
    bus.on("样式风格", function(result) {
        return function() {
            let env = bus.at("编译环境");
            try {
                let map;
                if (!result) {
                    if (env.theme) {
                        let file = getThemeBtfFile();
                        map = getThemeMapByFile(file);
                    } else {
                        map = new Map();
                    }
                    result = {
                        less: getThemeLess(map),
                        scss: getThemeScss(map),
                        css: getThemeCss(map)
                    };
                }
                return result;
            } catch (e) {
                throw Err.cat("init theme failed: " + env.theme, e);
            }
        };
    }());
    function getThemeLess(map) {
        let rs = [];
        map.forEach((v, k) => rs.push("@" + k + " : " + v + ";"));
        return rs.join("\n") + "\n";
    }
    function getThemeScss(map) {
        let rs = [];
        map.forEach((v, k) => rs.push("$" + k + " : " + v + ";"));
        return rs.join("\n") + "\n";
    }
    function getThemeCss(map) {
        if (!map.size) {
            return "";
        }
        let rs = [];
        rs.push(":root{");
        map.forEach((v, k) => rs.push("--" + k + " : " + v + ";"));
        rs.push("}");
        return rs.join("\n") + "\n";
    }
    function getThemeBtfFile() {
        let env = bus.at("编译环境");
        let file;
        if (env.theme.endsWith(".btf")) {
            if (File.exists(file)) {
                return file;
            }
            file = File.resolve(env.path.root, env.theme);
            if (File.exists(file)) {
                return file;
            }
            throw new Err("theme file not found: " + file);
        }
        return getThemeBtfFileByPkg(env.theme);
    }
    function getThemeBtfFileByPkg(themePkg) {
        let ary = [ ...require("find-node-modules")({
            cwd: __dirname,
            relative: false
        }), ...require("find-node-modules")({
            relative: false
        }) ];
        for (let i = 0, path, file; path = ary[i++]; ) {
            file = path.replace(/\\/g, "/") + "/" + themePkg + "/theme.btf";
            if (File.exists(file)) {
                return file;
            }
        }
        throw new Err("theme file not found: " + themePkg + "/theme.btf");
    }
    const fileSet = new Set();
    function getThemeMapByFile(file) {
        if (fileSet.has(file)) {
            let ary = [ ...fileSet ].push(file);
            throw Err.cat(ary, new Err("theme circular extend"));
        }
        fileSet.add(file);
        btf = new Btf(file);
        let superPkg = (btf.getText("extend") || "").trim();
        let superTheme;
        let theme = btf.getMap("theme");
        if (superPkg) {
            superTheme = getThemeMapByFile(getThemeBtfFileByPkg(superPkg));
            theme.forEach((v, k) => superTheme.set(k, v));
            theme = superTheme;
        }
        return theme;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    bus.on("编译插件", function() {
        return postobject.plugin("d15p-compile-component-scss", function(root, context) {
            let style = context.style;
            root.walk("RposeBlock", (node, object) => {
                if (/^scss$/.test(object.name.value)) {
                    let scss = object.text ? object.text.value : "";
                    if (scss) {
                        let theme = bus.at("样式风格");
                        style.scss = scssToCss(theme.scss + scss);
                    }
                    node.remove();
                    return false;
                }
            });
        });
    }());
    function scssToCss(scss) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify([ "scssToCss", scss ]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) {
                return cacheValue;
            }
        }
        let css = csjs.scssToCss(scss);
        return oCache.set(cacheKey, css);
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    bus.on("编译插件", function() {
        return postobject.plugin("d25p-compile-component-less", function(root, context) {
            let style = context.style;
            root.walk("RposeBlock", (node, object) => {
                if (/^less$/.test(object.name.value)) {
                    let less = object.text ? object.text.value : "";
                    if (less) {
                        let theme = bus.at("样式风格");
                        style.less = lessToCss(theme.less + less);
                    }
                    node.remove();
                    return false;
                }
            });
        });
    }());
    function lessToCss(less) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify([ "lessToCss", less ]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) {
                return cacheValue;
            }
        }
        let css = csjs.lessToCss(less);
        return oCache.set(cacheKey, css);
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const postcss = require("postcss");
    module.exports = bus.on("样式统一化整理", function() {
        return (css, from) => {
            let url = "copy";
            let fromPath = File.path(from);
            let toPath = bus.at("缓存").path + "/resources";
            let to = toPath + "/to.css";
            let assetsPath = toPath;
            let basePath = fromPath;
            let useHash = true;
            let hashOptions = {
                method: contents => hash({
                    contents: contents
                })
            };
            let postcssUrlOpt = {
                url: url,
                from: from,
                to: to,
                basePath: basePath,
                assetsPath: assetsPath,
                useHash: useHash,
                hashOptions: hashOptions
            };
            let env = bus.at("编译环境");
            let oCache = bus.at("缓存");
            let cacheKey = JSON.stringify([ "组件样式统一化", css, fromPath, toPath, assetsPath ]);
            let plugins = [];
            if (!env.nocache) {
                let cacheValue = oCache.get(cacheKey);
                if (cacheValue) {
                    return cacheValue;
                }
            }
            plugins.push(require("postcss-import-sync")({
                from: from
            }));
            plugins.push(require("postcss-unprefix")());
            plugins.push(require("postcss-url")(postcssUrlOpt));
            plugins.push(require("postcss-nested")());
            plugins.push(require("postcss-css-variables")());
            plugins.push(require("postcss-discard-comments")({
                remove: x => 1
            }));
            plugins.push(require("postcss-minify-selectors"));
            plugins.push(require("postcss-minify-params"));
            plugins.push(require("postcss-normalize-string"));
            plugins.push(require("postcss-normalize-display-values"));
            plugins.push(require("postcss-normalize-positions"));
            plugins.push(require("postcss-normalize-repeat-style"));
            plugins.push(require("postcss-minify-font-values"));
            plugins.push(require("postcss-minify-gradients"));
            plugins.push(require("postcss-color-hex-alpha"));
            plugins.push(require("postcss-merge-longhand"));
            let rs = postcss(plugins).process(css, {
                from: from,
                to: to
            }).sync().root.toResult();
            return oCache.set(cacheKey, rs.css);
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    bus.on("编译插件", function() {
        return postobject.plugin("d35p-normalize-component-css", function(root, context) {
            let style = context.style;
            root.walk("RposeBlock", (node, object) => {
                if (/^css$/.test(object.name.value)) {
                    let css = object.text ? object.text.value : "";
                    if (css) {
                        let theme = bus.at("样式风格");
                        style.css = theme.css + css;
                    }
                    node.remove();
                    return false;
                }
            });
            if (!style.css) {
                return;
            }
            let from = context.input.file.replace(/\.rpose$/i, ".css");
            style.css = bus.at("样式统一化整理", style.css, from);
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const acorn = require("acorn");
    const astring = require("astring");
    bus.on("编译插件", function() {
        return postobject.plugin("d45p-normalize-component-actions", function(root, context) {
            let script = context.script;
            root.walk("RposeBlock", (node, object) => {
                if (!/^actions$/.test(object.name.value)) {
                    return;
                }
                let actions = object.text ? object.text.value.trim() : "";
                if (actions) {
                    let rs = generateActions(actions, object.text.loc);
                    script.actions = rs.src;
                    script.$actionkeys = rs.names;
                }
                node.remove();
                return false;
            });
        });
    }());
    function generateActions(code, loc) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify([ "generateActions", code ]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) {
                return cacheValue;
            }
        }
        let rs;
        if (code.startsWith("{")) {
            rs = generateObjActions(code, loc);
        } else {
            rs = generateFunActions(code, loc);
        }
        return oCache.set(cacheKey, rs);
    }
    function generateFunActions(code, loc) {
        let ast;
        try {
            ast = acorn.parse(code, {
                ecmaVersion: 10,
                sourceType: "module",
                locations: true
            });
        } catch (e) {
            throw new Err("syntax error in [actions]", e);
        }
        let map = new Map();
        ast.body.forEach(node => {
            let nd;
            if (node.type == "FunctionDeclaration") {
                node.type = "ArrowFunctionExpression";
                map.set(node.id.name, astring.generate(node));
            } else if (node.type == "VariableDeclaration") {
                nd = node.declarations[0].init;
                if (nd.type == "FunctionDeclaration" || nd.type == "ArrowFunctionExpression") {
                    nd.type = "ArrowFunctionExpression";
                    map.set(node.declarations[0].id.name, astring.generate(nd));
                }
            } else if (node.type == "ExpressionStatement") {
                nd = node.expression.right;
                if (nd.type == "FunctionDeclaration" || nd.type == "ArrowFunctionExpression") {
                    nd.type = "ArrowFunctionExpression";
                    map.set(node.expression.left.name, astring.generate(nd));
                }
            }
        });
        let names = [ ...map.keys() ];
        let rs = {
            src: "",
            names: names
        };
        if (names.length) {
            let ary = [];
            ary.push("this.$actions = {");
            names.forEach(k => {
                ary.push('"' + k + '": ' + map.get(k) + ",");
            });
            ary.push("}");
            rs.src = ary.join("\n");
        }
        return rs;
    }
    function generateObjActions(code, loc) {
        let src = `this.$actions     = ${code}`;
        let ast;
        try {
            ast = acorn.parse(src, {
                ecmaVersion: 10,
                sourceType: "module",
                locations: true
            });
        } catch (e) {
            throw new Err("syntax error in [actions]", e);
        }
        let names = [];
        let properties = ast.body[0].expression.right.properties;
        properties && properties.forEach(node => {
            if (node.value.type == "ArrowFunctionExpression") {
                names.push(node.key.name);
            } else if (node.value.type == "FunctionExpression") {
                let nd = node.value;
                nd.type = "ArrowFunctionExpression";
                names.push(node.key.name);
            }
        });
        let rs = {
            src: "",
            names: names
        };
        if (names.length) {
            names.sort();
            rs.src = astring.generate(ast);
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const acorn = require("acorn");
    const astring = require("astring");
    bus.on("编译插件", function() {
        return postobject.plugin("d55p-normalize-component-methods", function(root, context) {
            let script = context.script;
            root.walk("RposeBlock", (node, object) => {
                if (!/^methods$/.test(object.name.value)) {
                    return;
                }
                let methods = object.text ? object.text.value.trim() : "";
                if (methods) {
                    let rs = generateMethods(methods, object.text.loc);
                    script.methods = rs.src;
                }
                node.remove();
                return false;
            });
        });
    }());
    function generateMethods(methods, loc) {
        let env = bus.at("编译环境");
        let oCache = bus.at("缓存");
        let cacheKey = JSON.stringify([ "generateMethods", methods ]);
        if (!env.nocache) {
            let cacheValue = oCache.get(cacheKey);
            if (cacheValue) {
                return cacheValue;
            }
        }
        let code = `oFn               = ${methods}`;
        let ast;
        try {
            ast = acorn.parse(code, {
                ecmaVersion: 10,
                sourceType: "module",
                locations: true
            });
        } catch (e) {
            throw new Err("syntax error in [methods]", e);
        }
        let map = new Map();
        let properties = ast.body[0].expression.right.properties;
        properties && properties.forEach(node => {
            if (node.value.type == "ArrowFunctionExpression") {
                map.set(node.key.name, "this." + node.key.name + "=" + astring.generate(node.value));
            } else if (node.value.type == "FunctionExpression") {
                let arrNode = node.value;
                arrNode.type = "ArrowFunctionExpression";
                map.set(node.key.name, "this." + node.key.name + "=" + astring.generate(arrNode));
            }
        });
        let names = [ ...map.keys() ];
        names.sort();
        let rs = {
            src: "",
            names: names
        };
        names.forEach(k => rs.src += map.get(k) + "\n");
        return oCache.set(cacheKey, rs);
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("d75p-init-component-[csslib]", function(root, context) {
            let prj = bus.at("项目配置处理", context.input.file);
            let oCsslib = context.result.oCsslib = Object.assign({}, prj.oCsslib || {});
            let oCsslibPkgs = context.result.oCsslibPkgs = Object.assign({}, prj.oCsslibPkgs || {});
            root.walk("RposeBlock", (node, object) => {
                if (object.name.value !== "csslib") {
                    return;
                }
                if (!object.text || !object.text.value || !object.text.value.trim()) {
                    return;
                }
                let oKv = bus.at("解析[csslib]", object.text.value, context, object.text.loc);
                for (let k in oKv) {
                    if (oCsslib[k]) {
                        throw new Err("duplicate csslib name: " + k, {
                            file: context.input.file,
                            text: context.input.text,
                            line: object.text.loc.start.line,
                            column: 1
                        });
                    }
                    oCsslib[k] = bus.at("样式库", `${k}=${oKv[k]}`);
                    oCsslibPkgs[k] = oCsslib[k].pkg;
                }
                node.remove();
                return false;
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("d85p-init-component-[taglib]", function(root, context) {
            let prj = bus.at("项目配置处理", context.input.file);
            let oTaglib = context.result.oTaglib = Object.assign({}, prj.oTaglib || {});
            root.walk("RposeBlock", (node, object) => {
                if (object.name.value !== "taglib") {
                    return;
                }
                if (!object.text || !object.text.value || !object.text.value.trim()) {
                    return;
                }
                let oKv = bus.at("解析[taglib]", object.text.value, context, object.text.loc);
                for (let k in oKv) {
                    if (oTaglib[k]) {
                        throw new Err("duplicate taglib name: " + k, {
                            file: context.input.file,
                            text: context.input.text,
                            line: object.text.loc.start.line + oTaglib[k].line,
                            column: 1
                        });
                    }
                }
                let mapPkg = new Map();
                for (let key in oKv) {
                    mapPkg.set(oKv[key].pkg, oKv[key]);
                }
                mapPkg.forEach((oTag, pkg) => {
                    if (!bus.at("自动安装", pkg)) {
                        throw new Err("package install failed: " + pkg, {
                            file: context.input.file,
                            text: context.input.text,
                            line: object.text.loc.start.line + oTag.line,
                            column: 1
                        });
                    }
                });
                for (let key in oKv) {
                    try {
                        bus.at("标签库定义", oKv[key].taglib, context.input.file);
                    } catch (e) {
                        throw new Err.cat(e, {
                            file: context.input.file,
                            text: context.input.text,
                            line: object.text.loc.start.line + oKv[key].line,
                            column: 1
                        });
                    }
                }
                node.remove();
                return false;
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    module.exports = bus.on("视图编译选项", function(options = {}, init) {
        options.CodeBlockStart = "{%";
        options.CodeBlockEnd = "%}";
        options.ExpressionStart = "{";
        options.ExpressionEnd = "}";
        options.TypeHtmlComment = "HtmlComment";
        options.TypeCodeBlock = "JsCode";
        options.TypeExpression = "Expression";
        options.TypeTagOpen = "TagOpen";
        options.TypeTagClose = "TagClose";
        options.TypeTagSelfClose = "TagSelfClose";
        options.TypeAttributeName = "AttributeName";
        options.TypeAttributeValue = "AttributeValue";
        options.TypeEqual = "=";
        options.TypeText = "Text";
        return function(opts) {
            if (!init && opts) {
                init = true;
                options.CodeBlockStart = opts.CodeBlockStart || options.CodeBlockStart;
                options.CodeBlockEnd = opts.CodeBlockEnd || options.CodeBlockEnd;
                options.ExpressionStart = opts.ExpressionStart || options.ExpressionStart;
                options.ExpressionEnd = opts.ExpressionEnd || options.ExpressionEnd;
                options.TypeHtmlComment = opts.TypeHtmlComment || options.TypeHtmlComment;
                options.TypeCodeBlock = opts.TypeCodeBlock || options.TypeCodeBlock;
                options.TypeExpression = opts.TypeExpression || options.TypeExpression;
                options.TypeTagOpen = opts.TypeTagOpen || options.TypeTagOpen;
                options.TypeTagClose = opts.TypeTagClose || options.TypeTagClose;
                options.TypeTagSelfClose = opts.TypeTagSelfClose || options.TypeTagSelfClose;
                options.TypeAttributeName = opts.TypeAttributeName || options.TypeAttributeName;
                options.TypeAttributeValue = opts.TypeAttributeValue || options.TypeAttributeValue;
                options.TypeEqual = opts.TypeEqual || options.TypeEqual;
                options.TypeText = opts.TypeText || options.TypeText;
            }
            return options;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    bus.on("是否表达式", function() {
        const OPTS = bus.at("视图编译选项");
        return function(val) {
            if (!val) {
                return false;
            }
            let tmp = val.replace(/\\\{/g, "").replace(/\\\}/g, "");
            return /\{.*\}/.test(tmp);
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const SOF = "\0";
    const EOF = "￿";
    class CharReader {
        constructor(src) {
            this.ary = src.split("");
            this.maxLength = this.ary.length;
            this.pos = 0;
        }
        skip(len) {
            if (len > 0) {
                this.pos = this.pos + len;
                if (this.pos > this.maxLength) {
                    this.pos = this.maxLength;
                }
            }
            return this.pos;
        }
        skipBlank() {
            let rs = "";
            while (/\s/.test(this.getCurrentChar()) && !this.eof()) {
                rs += this.readChar();
            }
            return rs;
        }
        getPos() {
            return this.pos;
        }
        eof() {
            return this.pos >= this.maxLength;
        }
        readChar() {
            let rs = this.getCurrentChar();
            this.pos < this.maxLength && (this.pos += 1);
            return rs;
        }
        getPrevChar() {
            return this.pos == 0 ? SOF : this.ary[this.pos - 1];
        }
        getCurrentChar() {
            return this.pos >= this.maxLength ? EOF : this.ary[this.pos];
        }
        getNextChar(len = 1) {
            let idx = len < 1 ? 1 : len;
            return this.pos + idx >= this.maxLength ? EOF : this.ary[this.pos + idx];
        }
        getChar(idx = 0) {
            return idx < 0 ? SOF : idx >= this.maxLength ? EOF : this.ary[idx];
        }
        getPrevString(len) {
            return this.getString(this.pos - len, this.pos);
        }
        getString(start, end) {
            let min = start < 0 ? 0 : start >= this.maxLength ? this.maxLength - 1 : start;
            let max = end < 0 ? 0 : end > this.maxLength ? this.maxLength : end;
            let rs = "";
            for (let i = min; i < max; i++) {
                rs += this.ary[i];
            }
            return rs;
        }
        getNextString(len) {
            return this.getString(this.pos, this.pos + len);
        }
    }
    module.exports = bus.on("字符阅读器", function(srcView) {
        return new CharReader(srcView);
    });
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    const SELF_CLOSE_TAGS = "br,hr,input,img,meta,link,area,base,basefont,bgsound,col,command,isindex,frame,embed,keygen,menuitem,nextid,param,source,track,wbr".split(",");
    function escape(str) {
        return str == null ? null : str.replace(/\\{/g, "\0").replace(/\\}/g, "￾￿");
    }
    function unescape(str) {
        return str == null ? null : str.replace(/\u0000\u0001/g, "{").replace(/\ufffe\uffff/g, "}");
    }
    function getLocation(src, startPos, endPos, PosOffset) {
        let ary, line, start = {}, end = {};
        ary = src.substring(0, startPos + PosOffset).split("\n");
        start.line = ary.length;
        line = ary.pop();
        start.column = line.length + 1;
        start.pos = PosOffset + startPos;
        ary = src.substring(0, endPos + PosOffset).split("\n");
        end.line = ary.length;
        line = ary.pop();
        end.column = line.length;
        end.pos = PosOffset + endPos;
        if (!line.length) {
            end.line--;
            end.column = ary.pop().length + 1;
        }
        return {
            start: start,
            end: end
        };
    }
    function TokenParser(fileText, viewText, file, PosOffset) {
        let src = escape(viewText);
        let options = bus.at("视图编译选项");
        let reader = bus.at("字符阅读器", src);
        let tokens = [];
        this.parse = function() {
            while (parseNode() || parseComment() || parseCdata() || parseCodeBlock() || parseExpression() || parseHighlight() || parseText()) {}
            tokens.forEach(token => {
                token.loc = getLocation(fileText, token.pos.start, token.pos.end, PosOffset);
                delete token.pos;
            });
            return tokens;
        };
        function parseNode() {
            let pos = reader.getPos();
            if (reader.getCurrentChar() !== "<" || reader.eof() || reader.getNextString(4) === "\x3c!--" || reader.getNextString(9) === "<![CDATA[" || src.indexOf(options.CodeBlockStart, pos) == pos || src.indexOf(options.ExpressionStart, pos) == pos) {
                return 0;
            }
            let token, tagNm = "", oPos;
            if (reader.getNextString(2) === "</") {
                let idx = src.indexOf(">", pos + 3);
                if (idx < 0) {
                    return 0;
                } else {
                    oPos = {};
                    oPos.start = reader.getPos();
                    reader.skip(2);
                    while (reader.getCurrentChar() !== ">" && !reader.eof()) {
                        tagNm += reader.readChar();
                    }
                    reader.skip(1);
                    oPos.end = reader.getPos();
                    token = {
                        type: options.TypeTagClose,
                        value: tagNm.trim(),
                        pos: oPos
                    };
                    tokens.push(token);
                    return 1;
                }
            }
            if (reader.getCurrentChar() === "<" && src.indexOf(">", pos + 2) < 0) {
                return 0;
            }
            if (!/[a-z]/i.test(reader.getNextChar())) {
                return 0;
            }
            oPos = {};
            oPos.start = reader.getPos();
            reader.skip(1);
            while (/[^\s\/>]/.test(reader.getCurrentChar())) {
                tagNm += reader.readChar();
            }
            let tokenTagNm = {
                type: "",
                value: unescape(tagNm).trim(),
                pos: oPos
            };
            tokens.push(tokenTagNm);
            while (parseAttr()) {}
            reader.skipBlank();
            if (reader.getNextString(2) === "/>") {
                tokenTagNm.type = options.TypeTagSelfClose;
                reader.skip(2);
                oPos.end = reader.getPos();
                return 1;
            }
            if (reader.getCurrentChar() === ">") {
                if (SELF_CLOSE_TAGS.includes(tagNm.toLowerCase())) {
                    tokenTagNm.type = options.TypeTagSelfClose;
                } else {
                    tokenTagNm.type = options.TypeTagOpen;
                }
                reader.skip(1);
                oPos.end = reader.getPos();
                return 1;
            }
            throw new Err('tag missing ">"', "file=" + file, {
                text: fileText,
                start: oPos.start + PosOffset
            });
        }
        function parseAttr() {
            if (reader.eof()) {
                return 0;
            }
            reader.skipBlank();
            let oPos = {};
            oPos.start = reader.getPos();
            let key = "", val = "";
            if (reader.getCurrentChar() === "{") {
                let stack = [];
                key += reader.readChar();
                while (!reader.eof()) {
                    if (reader.getCurrentChar() === "{") {
                        if (reader.getPrevChar() !== "\\") {
                            stack.push("{");
                        }
                    }
                    if (reader.getCurrentChar() === "}") {
                        if (reader.getPrevChar() !== "\\") {
                            if (!stack.length) {
                                key += reader.readChar();
                                break;
                            }
                            stack.pop();
                        }
                    }
                    key += reader.readChar();
                }
                if (!key) {
                    return 0;
                }
            } else {
                while (/[^\s=\/>]/.test(reader.getCurrentChar())) {
                    key += reader.readChar();
                }
                if (!key) {
                    return 0;
                }
            }
            oPos.end = reader.getPos();
            let token = {
                type: options.TypeAttributeName,
                value: unescape(key),
                pos: oPos
            };
            tokens.push(token);
            reader.skipBlank();
            oPos = {};
            oPos.start = reader.getPos();
            if (reader.getCurrentChar() === "=") {
                oPos.end = reader.getPos() + 1;
                token = {
                    type: options.TypeEqual,
                    value: "=",
                    pos: oPos
                };
                tokens.push(token);
                let PosEqual = reader.getPos() + PosOffset + 1;
                reader.skip(1);
                reader.skipBlank();
                oPos = {};
                oPos.start = reader.getPos();
                if (reader.getCurrentChar() === '"') {
                    reader.skip(1);
                    let posStart = reader.getPos();
                    while (!reader.eof() && reader.getCurrentChar() !== '"') {
                        let ch = reader.readChar();
                        ch !== "\r" && ch !== "\n" && (val += ch);
                    }
                    if (reader.eof() || reader.getCurrentChar() !== '"') {
                        throw new Err('invalid attribute value format (missing ")', "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }
                    reader.skip(1);
                    oPos.end = reader.getPos();
                    token = {
                        type: options.TypeAttributeValue,
                        value: unescape(val),
                        pos: oPos
                    };
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "'") {
                    reader.skip(1);
                    let posStart = reader.getPos();
                    while (!reader.eof() && reader.getCurrentChar() !== "'") {
                        let ch = reader.readChar();
                        ch != "\r" && ch != "\n" && (val += ch);
                    }
                    if (reader.eof() || reader.getCurrentChar() !== "'") {
                        throw new Err("invalid attribute value format (missing ')", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }
                    reader.skip(1);
                    oPos.end = reader.getPos();
                    token = {
                        type: options.TypeAttributeValue,
                        value: unescape(val),
                        pos: oPos
                    };
                    tokens.push(token);
                } else if (reader.getCurrentChar() === "{") {
                    let stack = [];
                    let posStart = reader.getPos() + 1;
                    while (!reader.eof()) {
                        if (reader.getCurrentChar() === "{") {
                            stack.push("{");
                        } else if (reader.getCurrentChar() === "}") {
                            if (!stack.length) {
                                break;
                            } else if (stack.length === 1) {
                                val += reader.readChar();
                                break;
                            } else {
                                stack.pop();
                            }
                        }
                        val += reader.readChar();
                    }
                    if (reader.eof()) {
                        throw new Err("invalid attribute value format (missing })", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: posStart + PosOffset
                        });
                    }
                    oPos.end = reader.getPos();
                    token = {
                        type: options.TypeAttributeValue,
                        value: unescape(val),
                        pos: oPos
                    };
                    tokens.push(token);
                } else {
                    while (/[^\s\/>]/.test(reader.getCurrentChar())) {
                        val += reader.readChar();
                    }
                    if (!val) {
                        throw new Err("missing attribute value", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: PosEqual + 1
                        });
                    }
                    if (!/^(\d+|\d+\.?\d+)$/.test(val)) {
                        throw new Err("invalid attribute value", "file=" + file, {
                            text: fileText,
                            start: PosEqual,
                            end: reader.getPos() + PosOffset
                        });
                    }
                    oPos.end = reader.getPos();
                    token = {
                        type: options.TypeAttributeValue,
                        value: val - 0,
                        pos: oPos
                    };
                    tokens.push(token);
                }
            } else {}
            return 1;
        }
        function parseComment() {
            let token, pos = reader.getPos();
            let idxStart = src.indexOf("\x3c!--", pos), idxEnd = src.indexOf("--\x3e", pos + 4);
            if (idxStart === pos && idxEnd > pos) {
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + 3;
                token = {
                    type: options.TypeHtmlComment,
                    value: unescape(src.substring(pos + 4, idxEnd)),
                    pos: oPos
                };
                reader.skip(idxEnd + 3 - pos);
                tokens.push(token);
                return 1;
            }
            return 0;
        }
        function parseCdata() {
            let token, pos = reader.getPos();
            let idxStart = src.indexOf("<![CDATA[", pos), idxEnd = src.indexOf("]]>", pos + 9);
            if (idxStart === pos && idxEnd > pos) {
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + 3;
                let value = escape(src.substring(pos + 9, idxEnd));
                reader.skip(idxEnd + 3 - pos);
                if (!/\{.*?}/.test(value)) {
                    token = {
                        type: options.TypeText,
                        value: value,
                        pos: oPos
                    };
                    tokens.push(token);
                } else {
                    let idx1, idx2, txt, iStart = idxStart + 9, oPosTxt;
                    while ((idx1 = value.indexOf("{")) >= 0 && (idx2 = value.indexOf("}", idx1)) > 0) {
                        if (idx1 > 0) {
                            txt = unescape(value.substring(0, idx1));
                            oPosTxt = {
                                start: iStart,
                                end: iStart + txt.length
                            };
                            iStart = oPosTxt.end;
                            token = {
                                type: options.TypeText,
                                value: txt,
                                pos: oPosTxt
                            };
                            tokens.push(token);
                        }
                        txt = unescape(value.substring(idx1, idx2 + 1));
                        oPosTxt = {
                            start: iStart,
                            end: iStart + txt.length
                        };
                        iStart = oPosTxt.end;
                        token = {
                            type: options.TypeExpression,
                            value: txt,
                            pos: oPosTxt
                        };
                        tokens.push(token);
                        value = value.substring(idx2 + 1);
                    }
                    if (value) {
                        txt = unescape(value);
                        oPosTxt = {
                            start: iStart,
                            end: iStart + txt.length
                        };
                        iStart = oPosTxt.end;
                        token = {
                            type: options.TypeText,
                            value: txt,
                            pos: oPosTxt
                        };
                        tokens.push(token);
                    }
                }
                return 1;
            }
            return 0;
        }
        function parseHighlight() {
            let pos = reader.getPos(), start, end;
            if (!((pos === 0 || reader.getPrevChar() === "\n") && src.indexOf("```", pos) === pos && src.indexOf("\n```", pos + 3) > 0)) {
                return 0;
            }
            let str = src.substring(pos);
            let rs = /(^```[\s\S]*?\r?\n)([\s\S]*?)\r?\n```[\s\S]*?\r?(\n|$)/.exec(str);
            let len = rs[0].length;
            let token, oPos = {};
            start = pos;
            end = pos + len;
            token = {
                type: options.TypeTagSelfClose,
                value: "```",
                pos: {
                    start: start,
                    end: end
                }
            };
            tokens.push(token);
            let match = rs[1].match(/\b\w*\b/);
            let lang = match ? match[0].toLowerCase() : "";
            if (lang) {
                start = pos + match.index;
                end = start + lang.length;
                token = {
                    type: options.TypeAttributeName,
                    value: "lang",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                token = {
                    type: options.TypeEqual,
                    value: "=",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                token = {
                    type: options.TypeAttributeValue,
                    value: lang,
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
            }
            match = rs[1].match(/\b\d+(\%|px)/i);
            let height;
            if (match) {
                height = match[0];
            } else {
                match = rs[1].match(/\b\d+/i);
                match && (height = match[0]);
            }
            if (height) {
                start = pos + match.index;
                end = start + height.length;
                token = {
                    type: options.TypeAttributeName,
                    value: "height",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                token = {
                    type: options.TypeEqual,
                    value: "=",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                height = /^\d+$/.test(height) ? height + "px" : height;
                token = {
                    type: options.TypeAttributeValue,
                    value: height,
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
            }
            match = rs[1].match(/\bref\s?=\s?"(.*?)"/i);
            let ref = match && match[0] ? match[0] : "";
            if (ref) {
                token = {
                    type: options.TypeAttributeName,
                    value: "ref",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                token = {
                    type: options.TypeEqual,
                    value: "=",
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
                token = {
                    type: options.TypeAttributeValue,
                    value: ref,
                    pos: {
                        start: start,
                        end: end
                    }
                };
                tokens.push(token);
            }
            let $CODE = rs[2].replace(/\u0000\u0001/g, "\\{").replace(/\ufffe\uffff/g, "\\}");
            $CODE = $CODE.replace(/\n\\+```/g, match => "\n" + match.substring(2));
            /^\\+```/.test($CODE) && ($CODE = $CODE.substring(1));
            $CODE = $CODE.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
            start = pos + rs[1].length;
            end = start + rs[2].length;
            token = {
                type: options.TypeAttributeName,
                value: "$CODE",
                pos: {
                    start: start,
                    end: end
                }
            };
            tokens.push(token);
            token = {
                type: options.TypeEqual,
                value: "=",
                pos: {
                    start: start,
                    end: end
                }
            };
            tokens.push(token);
            token = {
                type: options.TypeAttributeValue,
                value: $CODE,
                pos: {
                    start: start,
                    end: end
                }
            };
            tokens.push(token);
            reader.skip(len);
            return 1;
        }
        function parseCodeBlock() {
            let token, pos = reader.getPos();
            let idxStart = src.indexOf(options.CodeBlockStart, pos), idxEnd = src.indexOf(options.CodeBlockEnd, pos + options.CodeBlockStart.length);
            if (idxStart === pos && idxEnd > 0) {
                let oPos = {};
                oPos.start = idxStart;
                oPos.end = idxEnd + options.CodeBlockEnd.length;
                token = {
                    type: options.TypeCodeBlock,
                    value: unescape(src.substring(pos + options.CodeBlockStart.length, idxEnd)),
                    pos: oPos
                };
                reader.skip(idxEnd + options.CodeBlockEnd.length - pos);
                tokens.push(token);
                return 1;
            }
            return 0;
        }
        function parseText() {
            if (reader.eof()) {
                return 0;
            }
            let oPos = {};
            oPos.start = reader.getPos();
            let token, text = "", pos;
            while (!reader.eof()) {
                text += reader.readChar();
                pos = reader.getPos();
                if (reader.getCurrentChar() === "<" || reader.getNextString(3) === "```" || src.indexOf(options.CodeBlockStart, pos) === pos || src.indexOf(options.ExpressionStart, pos) === pos) {
                    break;
                }
            }
            if (text) {
                oPos.end = reader.getPos();
                token = {
                    type: options.TypeText,
                    value: unescape(text),
                    pos: oPos
                };
                tokens.push(token);
                return 1;
            }
            return 0;
        }
        function parseExpression() {
            if (reader.eof()) {
                return 0;
            }
            let token;
            let oPos = {};
            oPos.start = reader.getPos();
            token = parseExpr();
            if (token) {
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
            if (idxStart === pos && idxEnd > 0) {
                let rs = {
                    type: options.TypeExpression,
                    value: unescape(src.substring(pos, idxEnd + options.ExpressionEnd.length))
                };
                reader.skip(idxEnd + options.ExpressionEnd.length - pos);
                return rs;
            }
            return null;
        }
    }
    bus.on("视图TOKEN解析器", function(fileText, srcView, file, PosOffset) {
        return new TokenParser(fileText, srcView, file, PosOffset);
    });
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("e15p-parse-view-tokens-to-ast", function(root, context) {
            root.walk("RposeBlock", (node, object) => {
                if (!/^view$/.test(object.name.value)) {
                    return;
                }
                let view = object.text ? object.text.value : "";
                if (!view) {
                    return node.remove();
                }
                let tokenParser = bus.at("视图TOKEN解析器", context.input.text, view, context.input.file, object.text.loc.start.pos);
                let type = "View";
                let src = view;
                let loc = object.text.loc;
                let nodes = tokenParser.parse();
                let objToken = {
                    type: type,
                    src: src,
                    loc: loc,
                    nodes: nodes
                };
                let nodeToken = this.createNode(objToken);
                node.replaceWith(nodeToken);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("f15p-astedit-normalize-group-attribute", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(OPTS.TypeAttributeName, (node, object) => {
                let eqNode = node.after();
                if (eqNode && eqNode.type === OPTS.TypeEqual) {
                    let valNode = eqNode.after();
                    if (!valNode || !valNode.type === OPTS.TypeAttributeValue) {
                        throw new Err("missing attribute value");
                    }
                    if (bus.at("是否表达式", object.value)) {
                        throw new Err("unsupport expression on attribute name", {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }
                    if (/^\s*\{\s*\}\s*$/.test(valNode.object.value)) {
                        throw new Err("invalid empty expression", {
                            file: context.input.file,
                            text: context.input.text,
                            start: valNode.object.loc.start.pos,
                            end: valNode.object.loc.end.pos
                        });
                    }
                    let oAttr = {
                        type: "Attribute",
                        name: object.value,
                        value: valNode.object.value,
                        isExpression: bus.at("是否表达式", valNode.object.value),
                        loc: {
                            start: object.loc.start,
                            end: valNode.object.loc.end
                        }
                    };
                    let attrNode = this.createNode(oAttr);
                    node.replaceWith(attrNode);
                    eqNode.remove();
                    valNode.remove();
                } else {
                    let oAttr = {
                        type: "Attribute",
                        name: object.value,
                        value: true,
                        isExpression: false,
                        loc: object.loc
                    };
                    if (bus.at("是否表达式", object.value)) {
                        oAttr.isExpression = true;
                        oAttr.isObjectExpression = true;
                        delete oAttr.value;
                    }
                    let attrNode = this.createNode(oAttr);
                    node.replaceWith(attrNode);
                }
            });
            root.walk("Attribute", (node, object) => {
                if (!node.parent) {
                    return;
                }
                let ary = [ node ];
                let nextNode = node.after();
                while (nextNode && nextNode.type === "Attribute") {
                    ary.push(nextNode);
                    nextNode = nextNode.after();
                }
                let attrsNode = this.createNode({
                    type: "Attributes"
                });
                node.before(attrsNode);
                ary.forEach(n => {
                    attrsNode.addChild(n.clone());
                    n.remove();
                });
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("f25p-astedit-normolize-tag-of-self-close", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(OPTS.TypeTagSelfClose, (node, object) => {
                let type = "Tag";
                let value = object.value;
                let loc = object.loc;
                let tagNode = this.createNode({
                    type: type,
                    value: value,
                    loc: loc
                });
                let tagAttrsNode = node.after();
                if (tagAttrsNode && tagAttrsNode.type === "Attributes") {
                    tagNode.addChild(tagAttrsNode.clone());
                    tagAttrsNode.remove();
                }
                node.replaceWith(tagNode);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("f35p-astedit-normolize-tag-of-open-close", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            let normolizeTagNode = (tagNode, nodeTagOpen) => {
                let nextNode = nodeTagOpen.after();
                while (nextNode && nextNode.type !== OPTS.TypeTagClose) {
                    if (nextNode.type === OPTS.TypeTagOpen) {
                        let type = "Tag";
                        let value = nextNode.object.value;
                        let loc = nextNode.object.loc;
                        let subTagNode = this.createNode({
                            type: type,
                            value: value,
                            loc: loc
                        });
                        normolizeTagNode(subTagNode, nextNode);
                        tagNode.addChild(subTagNode);
                    } else {
                        tagNode.addChild(nextNode.clone());
                    }
                    nextNode.remove();
                    nextNode = nodeTagOpen.after();
                }
                if (!nextNode) {
                    throw new Err("missing close tag", "file=" + context.input.file, {
                        text: context.input.text,
                        start: tagNode.object.loc.start.pos
                    });
                }
                if (nextNode.type === OPTS.TypeTagClose) {
                    if (nodeTagOpen.object.value !== nextNode.object.value) {
                        throw new Err(`unmatch close tag: ${nodeTagOpen.object.value}/${nextNode.object.value}`, "file=" + context.input.file, {
                            text: context.input.text,
                            start: tagNode.object.loc.start.pos,
                            end: nextNode.object.loc.end.pos
                        });
                    }
                    tagNode.object.loc.end = nextNode.object.loc.end;
                    nextNode.remove();
                    return tagNode;
                }
                throw new Error("todo unhandle type");
            };
            root.walk(OPTS.TypeTagOpen, (node, object) => {
                if (!node.parent) {
                    return;
                }
                let type = "Tag";
                let value = object.value;
                let loc = object.loc;
                let tagNode = this.createNode({
                    type: type,
                    value: value,
                    loc: loc
                });
                normolizeTagNode(tagNode, node);
                node.replaceWith(tagNode);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("BTF内容解析", function() {
        return function(text) {
            let LF = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
            let lines = text.split(LF);
            let tokens = [];
            parse(tokens, lines);
            tokens.forEach(token => {
                if (token.type === "BlockText") {
                    token.value = token.value.join(LF);
                }
            });
            return tokens;
        };
    }());
    function parse(tokens, lines) {
        let sLine, oName, comment, blockStart = false;
        for (let i = 0; i < lines.length; i++) {
            sLine = lines[i];
            if (isBlockStart(sLine)) {
                oName = getBlockName(sLine);
                comment = sLine.substring(oName.len + 2);
                tokens.push({
                    type: "BlockName",
                    name: oName.name,
                    comment: comment
                });
                blockStart = true;
            } else if (isBlockEnd(sLine)) {
                tokens.push({
                    type: "Comment",
                    value: sLine
                });
                blockStart = false;
            } else if (isDocumentEnd(sLine)) {
                tokens.push({
                    type: "Comment",
                    value: sLine
                });
                blockStart = false;
            } else {
                if (blockStart) {
                    if (tokens[tokens.length - 1].type !== "BlockText") {
                        tokens.push({
                            type: "BlockText",
                            name: tokens[tokens.length - 1].name,
                            value: []
                        });
                    }
                    let oBlockText = tokens[tokens.length - 1];
                    oBlockText.value.push(sLine);
                } else {
                    tokens.push({
                        type: "Comment",
                        value: sLine
                    });
                }
            }
        }
    }
    function isBlockStart(sLine) {
        return sLine.startsWith("[") && sLine.indexOf("]") > 0;
    }
    function isBlockEnd(sLine) {
        return sLine.startsWith("---------");
    }
    function isDocumentEnd(sLine) {
        return sLine.startsWith("=========");
    }
    function getBlockName(sLine) {
        let name, len;
        for (let i = 1; i < sLine.length; i++) {
            if (sLine.charAt(i - 1) !== "\\" && sLine.charAt(i) === "]") {
                name = sLine.substring(1, i).toLowerCase();
                len = name.length;
                return {
                    name: name,
                    len: len
                };
            }
        }
        name = sLine.substring(1, sLine.lastIndexOf("]")).toLowerCase();
        len = name.length;
        return {
            name: name,
            len: len
        };
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const refractor = require("refractor");
    const rehype = require("rehype");
    inilike.displayName = "inilike";
    inilike.aliases = [];
    function inilike(Prism) {
        Prism.languages.inilike = {
            constant: /^[ \t]*[^\s=:]+?(?=[ \t]*[=:])/m,
            "attr-value": {
                pattern: /(=|:).*/,
                inside: {
                    punctuation: /^(=|:)/
                }
            }
        };
    }
    refractor.register(inilike);
    bus.on("语法高亮转换", function(tagpkgHighlight = "@rpose/buildin:```", oClass) {
        return function(code = "", lang = "clike") {
            if (!oClass) {
                oClass = {};
                oClass["token"] = bus.at("哈希样式类名", tagpkgHighlight, "token");
                oClass["comment"] = bus.at("哈希样式类名", tagpkgHighlight, "comment");
                oClass["selector"] = bus.at("哈希样式类名", tagpkgHighlight, "selector");
            }
            if (/^(btf|rpose)$/i.test(lang)) {
                let html = highlightBtfLike(code);
                return "<ol><li>" + html.split(/\r?\n/).join("</li><li>") + "</li></ol>";
            }
            !refractor.registered(lang) && (lang = "clike");
            let html = highlight(code, lang);
            return "<ol><li>" + html.split(/\r?\n/).join("</li><li>") + "</li></ol>";
        };
        function highlightBtfLike(code) {
            let html = [];
            let tokens = bus.at("BTF内容解析", code);
            tokens.forEach(token => {
                if (token.type === "BlockName") {
                    html.push(btfBlockName("[" + token.name + "]") + btfComment(token.comment));
                } else if (token.type === "BlockText") {
                    let lang = token.name;
                    if (!refractor.registered(lang)) {
                        if (/^(actions|methods|options|state)$/i.test(lang)) {
                            lang = "js";
                        } else if (/^view$/i.test(lang)) {
                            lang = "markup";
                        } else {
                            lang = "inilike";
                        }
                    }
                    html.push(highlight(token.value, lang));
                } else if (token.type === "Comment") {
                    html.push(btfComment(token.value));
                } else {
                    throw new Error("unknow type");
                }
            });
            return html.join("\n");
        }
        function btfComment(code) {
            return code.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/(\S+.*)/g, `<span class="${oClass["token"]} ${oClass["comment"]}">$1</span>`);
        }
        function btfBlockName(code) {
            return code.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/(.*)/g, `<span class="${oClass["token"]} ${oClass["selector"]}">$1</span>`);
        }
        function highlight(code, lang) {
            let nodes = refractor.highlight(code, lang);
            renameClassName(nodes);
            return rehype().stringify({
                type: "root",
                children: nodes
            }).toString();
        }
        function renameClassName(nodes) {
            nodes && nodes.forEach(node => {
                if (node.properties && node.properties.className) {
                    let classes = [];
                    node.properties.className.forEach(cls => {
                        !oClass[cls] && (oClass[cls] = bus.at("哈希样式类名", tagpkgHighlight, cls));
                        classes.push(oClass[cls]);
                    });
                    node.properties.className = classes;
                }
                renameClassName(node.children);
            });
        }
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("f45p-astedit-transform-tag-```", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (object.value !== "```") {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                let codeNode, lang;
                for (let i = 0, nd; nd = attrsNode.nodes[i++]; ) {
                    if (nd.object.name === "$CODE") {
                        codeNode = nd;
                        nd.object.value = nd.object.value.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
                    } else if (nd.object.name === "lang") {
                        lang = nd.object.value;
                    }
                }
                codeNode.object.value = bus.at("语法高亮转换", codeNode.object.value, lang);
                let taglibNode = this.createNode({
                    type: "Attribute"
                });
                taglibNode.object.name = "@taglib";
                taglibNode.object.value = "@rpose/buildin:```";
                let loc = Object.assign({}, object.loc);
                loc.end.line = loc.start.line;
                loc.end.column = 3;
                loc.end.pos = loc.start.pos + 3;
                taglibNode.object.loc = loc;
                attrsNode.addChild(taglibNode);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("f55p-astedit-normolize-flag-is-svg-tag", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!/^svg$/i.test(object.value)) {
                    return;
                }
                object.svg = true;
                node.walk("Tag", (nd, obj) => {
                    obj.svg = true;
                }, {
                    readonly: true
                });
            }, {
                readonly: true
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const REG_TAGS = /^(html|link|meta|style|title|address|article|aside|footer|header|h1|h2|h3|h4|h5|h6|hgroup|main|nav|section|blockquote|dd|dir|div|dl|dt|figcaption|figure|hr|li|ol|p|pre|ul|a|abbr|b|bdi|bdo|br|cite|code|data|dfn|em|i|kbd|mark|q|rb|rbc|rp|rt|rtc|ruby|s|samp|small|span|strong|sub|sup|time|tt|u|var|wbr|area|audio|img|map|track|video|applet|embed|iframe|noembed|object|param|picture|source|canvas|noscript|script|del|ins|caption|col|colgroup|table|tbody|td|tfoot|th|thead|tr|button|datalist|fieldset|form|input|label|legend|meter|optgroup|option|output|progress|select|textarea|details|dialog|menu|menuitem|summary|content|element|shadow|slot|template|acronym|basefont|bgsound|big|blink|center|command|font|frame|frameset|image|isindex|keygen|listing|marquee|multicol|nextid|nobr|noframes|plaintext|spacer|strike|xmp|head|base|body|math|svg)$/i;
    bus.on("编译插件", function() {
        return postobject.plugin("f65p-astedit-normolize-flag-is-standard-tag", function(root, context) {
            root.walk("Tag", (node, object) => {
                object.standard = !!object.svg || REG_TAGS.test(object.value);
            }, {
                readonly: true
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("g15p-astedit-group-attribtue-{prop}", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    nd.object.isObjectExpression && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                let groupNode = this.createNode({
                    type: "ObjectExpressionAttributes"
                });
                ary.forEach(nd => {
                    let cNode = nd.clone();
                    cNode.type = "ObjectExpressionAttribute";
                    cNode.object.type = "ObjectExpressionAttribute";
                    groupNode.addChild(cNode);
                    nd.remove();
                });
                node.addChild(groupNode);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;
    bus.on("编译插件", function() {
        return postobject.plugin("g25p-astedit-group-attribtue-events", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.object.standard) {
                    return;
                }
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    REG_EVENTS.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                let groupNode = this.createNode({
                    type: "Events"
                });
                ary.forEach(nd => {
                    let cNode = nd.clone();
                    cNode.type = "Event";
                    cNode.object.type = "Event";
                    groupNode.addChild(cNode);
                    nd.remove();
                });
                node.addChild(groupNode);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("g35p-astedit-process-attribtue-style", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^style$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of style", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "Style";
                oNode.object.type = "Style";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("g45p-astedit-process-attribtue-class", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^class$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of class", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "Class";
                oNode.object.type = "Class";
                oNode.object.classes = getClasses(oNode.object.value);
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
    function getClasses(clas) {
        let result = [];
        clas = clas.replace(/\{.*?\}/g, function(match) {
            let str = match.substring(1, match.length - 1);
            let idx, key, val;
            while (str.indexOf(":") > 0) {
                idx = str.indexOf(":");
                key = str.substring(0, idx).replace(/['"]/g, "").trim();
                val = str.substring(idx + 1);
                let idx2 = val.indexOf(":");
                if (idx2 > 0) {
                    val = val.substring(0, idx2);
                    val = val.substring(0, val.lastIndexOf(","));
                    str = str.substring(idx + 1 + val.length + 1);
                } else {
                    str = "";
                }
                key && result.push(key);
            }
            return "";
        });
        let ary = clas.split(/\s+/);
        for (let i = 0; i < ary.length; i++) {
            ary[i].trim() && result.push(ary[i].trim());
        }
        return result;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h15p-astedit-process-attribtue-@ref", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@ref$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @ref", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                if (/^(if|for)$/.test(object.value)) {
                    throw new Err(`unsupport attribute @ref on tag <${object.value}>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@ref";
                oNode.object.type = "@ref";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h25p-astedit-process-attribtue-@if", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@if$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @if", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@if";
                oNode.object.type = "@if";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h35p-astedit-process-attribtue-@show", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@show$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @show", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                if (/^(if|for)$/.test(object.value)) {
                    throw new Err(`unsupport attribute @show on tag <${object.value}>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@show";
                oNode.object.type = "@show";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h45p-astedit-process-attribtue-@for", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@for$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @for", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@for";
                oNode.object.type = "@for";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h55p-astedit-process-attribtue-@csslib", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@csslib$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @csslib", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                if (/^(if|for)$/.test(object.value)) {
                    throw new Err(`unsupport attribute @csslib on tag <${object.value}>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@csslib";
                oNode.object.type = "@csslib";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("h65p-astedit-process-attribtue-@taglib", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!node.nodes || !node.nodes.length) {
                    return;
                }
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let ary = [];
                attrsNode.nodes.forEach(nd => {
                    /^@taglib$/i.test(nd.object.name) && ary.push(nd);
                });
                if (!ary.length) {
                    return;
                }
                if (ary.legnth > 1) {
                    throw new Err("duplicate attribute of @taglib", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                if (/^(if|for)$/.test(object.value)) {
                    throw new Err(`unsupport @taglib on tag <${object.value}>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                let oNode = ary[0].clone();
                oNode.type = "@taglib";
                oNode.object.type = "@taglib";
                node.addChild(oNode);
                ary[0].remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    const Err = require("@gotoeasy/err");
    const postobject = require("@gotoeasy/postobject");
    const fs = require("fs");
    bus.on("编译插件", function() {
        return postobject.plugin("j15p-astedit-process-tag-img", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!/^img$/i.test(object.value)) {
                    return;
                }
                context.result.hasImg = true;
                let attrsNode;
                for (let i = 0, nd; nd = node.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    return;
                }
                let srcAttrNode;
                for (let i = 0, nd; nd = attrsNode.nodes[i++]; ) {
                    if (/^src$/i.test(nd.object.name)) {
                        srcAttrNode = nd;
                        break;
                    }
                }
                if (!srcAttrNode) {
                    return;
                }
                let imgname = hashImageName(context.input.file, srcAttrNode.object.value);
                if (!imgname) {
                    throw new Err("image file not found", {
                        file: context.input.file,
                        text: context.input.text,
                        start: srcAttrNode.object.loc.start.pos,
                        end: srcAttrNode.object.loc.end.pos
                    });
                }
                srcAttrNode.object.value = "%imagepath%" + imgname;
            }, {
                readonly: true
            });
        });
    }());
    function hashImageName(srcFile, imgFile) {
        let file;
        if (File.exists(imgFile)) {
            file = imgFile;
        } else {
            file = File.resolve(srcFile, imgFile);
            if (!File.exists(file)) {
                return false;
            }
        }
        let name = hash({
            file: file
        }) + File.extname(file);
        let oCache = bus.at("缓存");
        let distDir = oCache.path + "/resources";
        let distFile = distDir + "/" + name;
        if (!File.exists(distFile)) {
            !File.existsDir(distDir) && File.mkdir(distDir);
            fs.createReadStream(file).pipe(fs.createWriteStream(distFile));
        }
        return name;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k15p-astedit-transform-attribtue-@ref", function(root, context) {
            root.walk("@ref", (node, object) => {
                let tagNode = node.parent;
                if (bus.at("是否表达式", object.value)) {
                    throw new Err("@ref unsupport the expression", {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let attrsNode;
                for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                    if (nd.type === "Attributes") {
                        attrsNode = nd;
                        break;
                    }
                }
                let cNode = node.clone();
                cNode.type = "Attribute";
                cNode.object.type = "Attribute";
                cNode.object.name = "ref";
                let $contextNode = node.clone();
                $contextNode.type = "Attribute";
                $contextNode.object.type = "Attribute";
                $contextNode.object.name = "$context";
                $contextNode.object.value = "{$this}";
                $contextNode.object.isExpression = true;
                if (!attrsNode) {
                    attrsNode = this.createNode({
                        type: "Attributes"
                    });
                    tagNode.addChild(attrsNode);
                }
                attrsNode.addChild(cNode);
                attrsNode.addChild($contextNode);
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k25p-astedit-transform-attribtue-@if", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk("@if", (node, object) => {
                let tagNode = node.parent;
                /^if$/i.test(tagNode.object.value) && (tagNode.ok = true);
                let type = OPTS.TypeCodeBlock;
                let value = "if (" + object.value.replace(/^\s*\{=?/, "").replace(/\}\s*$/, "") + ") {";
                let jsNode = this.createNode({
                    type: type,
                    value: value
                });
                tagNode.before(jsNode);
                value = "}";
                jsNode = this.createNode({
                    type: type,
                    value: value
                });
                tagNode.after(jsNode);
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k35p-astedit-transform-attribtue-@show", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk("@show", (node, object) => {
                let tagNode = node.parent;
                let styleNode;
                for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                    if (nd.type === "Style") {
                        styleNode = nd;
                        break;
                    }
                }
                let display = OPTS.ExpressionStart + "(" + object.value.replace(/^\{/, "").replace(/\}$/, "") + ') ? "display:block;" : "display:none;"' + OPTS.ExpressionEnd;
                if (!styleNode) {
                    styleNode = this.createNode({
                        type: "Style",
                        value: display
                    });
                    tagNode.addChild(styleNode);
                } else {
                    if (styleNode.object.value.endsWith(";")) {
                        styleNode.object.value += display;
                    } else {
                        styleNode.object.value += ";" + display;
                    }
                }
                styleNode.object.isExpression = true;
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k45p-astedit-transform-attribtue-@for", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk("@for", (node, object) => {
                let tagNode = node.parent;
                /^for$/i.test(tagNode.object.value) && (tagNode.ok = true);
                let type = OPTS.TypeCodeBlock;
                let value = parseFor(context, object);
                let loc = object.loc;
                let jsNode = this.createNode({
                    type: type,
                    value: value,
                    loc: loc
                });
                tagNode.before(jsNode);
                value = "}";
                jsNode = this.createNode({
                    type: type,
                    value: value,
                    loc: loc
                });
                tagNode.after(jsNode);
                node.remove();
            });
        });
    }());
    function parseFor(context, object) {
        if (!object.value) {
            throw getError(context, object);
        }
        let value, index, from, max, array, match;
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[3];
            max = match[4];
            array = match[5];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[4];
            max = match[3];
            array = match[5];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            from = match[3];
            array = match[4];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=${from},MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            max = match[3];
            array = match[4];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = match[2];
            array = match[3];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = "J_";
            array = match[2];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(index)) {
                throw getError(context, object, `invalid index name: [${index}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        match = object.value.match(/^\s*\{*\s*(\w+)\s+in\s+(\S+?)\s*\}*\s*$/);
        if (match) {
            value = match[1];
            index = "J_";
            array = match[2];
            if (/^\d+/.test(value)) {
                throw getError(context, object, `invalid value name: [${value}]`);
            }
            if (/^\d+/.test(array)) {
                throw getError(context, object, `invalid array name: [${array}]`);
            }
            if (/[^a-zA-Z\d_]/.test(array)) {
                return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {\n                        ${value} = ARY_[${index}]; `;
            }
            return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {\n                    ${value} = ${array}[${index}]; `;
        }
        throw getError(context, object);
    }
    function getError(context, object, msg = "invalid format of @for") {
        return new Err(msg, {
            file: context.input.file,
            text: context.input.text,
            start: object.loc.start.pos,
            end: object.loc.end.pos
        });
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k55p-astedit-transform-tag-name-by-@taglib", function(root, context) {
            root.walk("@taglib", (node, object) => {
                let tagNode = node.parent;
                if (tagNode.object.standard) {
                    throw new Err("unsupport @taglib on standard tag", {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let cpFile = bus.at("标签项目源文件", tagNode.object.value);
                if (cpFile) {
                    throw new Err(`unsupport @taglib on existed component: ${tagNode.object.value}(${cpFile})`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let name, pkg, comp, match, taglib = object.value;
                if (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*:\s*(.+?)\s*$/)) {
                    pkg = match[1];
                    comp = match[2];
                } else if (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*$/)) {
                    pkg = match[1];
                    comp = tagNode.object.value;
                } else if (taglib.indexOf("=") >= 0) {
                    throw new Err("invalid attribute value of @taglib", {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                } else if (match = taglib.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/)) {
                    pkg = match[1];
                    comp = match[2];
                } else if (match = taglib.match(/^\s*(.+?)\s*$/)) {
                    pkg = match[1];
                    comp = tagNode.object.value;
                } else {
                    throw new Err("invalid attribute value of @taglib", {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let install = bus.at("自动安装", pkg);
                if (!install) {
                    throw new Err("package install failed: " + pkg, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let oPkg = bus.at("模块组件信息", pkg);
                let srcFile = bus.at("标签库引用", `${pkg}:${comp}`, oPkg.config);
                if (!srcFile) {
                    throw new Err("component not found: " + object.value, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let tagpkg = bus.at("标签全名", srcFile);
                tagNode.object.value = tagpkg;
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k65p-astedit-transform-tag-name-by-[taglib]", function(root, context) {
            let oTaglib = Object.assign({}, context.result.oTaglib);
            let ary, clsname, csslib, css;
            root.walk("Tag", (node, object) => {
                if (object.standard) {
                    return;
                }
                let taglib = oTaglib[object.value];
                if (!taglib) {
                    return;
                }
                let pkg, comp, ary = taglib.split(":");
                if (ary.length > 1) {
                    pkg = ary[0].trim();
                    comp = ary[1].trim();
                } else {
                    pkg = taglib.trim();
                    comp = object.value;
                }
                let install = bus.at("自动安装", pkg);
                if (!install) {
                    throw new Err("package install failed: " + pkg, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let oPkg = bus.at("模块组件信息", pkg);
                let srcFile = bus.at("标签库引用", `${pkg}:${comp}`, oPkg.config);
                if (!srcFile) {
                    throw new Err("component not found: " + object.value, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let tagpkg = bus.at("标签全名", srcFile);
                object.value = tagpkg;
            });
        }, {
            readonly: true
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("k75p-astedit-transform-tag-if-for", function(root, context) {
            root.walk("Tag", (node, object) => {
                if (!/^(if|for)$/i.test(object.value)) {
                    return;
                }
                if (!node.ok) {
                    throw new Err(`missing attribute @${object.value} of tag <${object.value}>`, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos
                    });
                }
                node.nodes.forEach(nd => {
                    nd.type !== "Attributes" && node.before(nd.clone());
                });
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const hash = require("@gotoeasy/hash");
    const AryNm = "_Ary";
    const SlotVnodes = "slotVnodes";
    bus.on("编译插件", function() {
        return postobject.plugin("k85p-astedit-transform-tag-slot", function(root, context) {
            let nonameSlotNodes = [];
            let options = bus.at("视图编译选项");
            root.walk("Tag", (node, object) => {
                if (!/^slot$/i.test(object.value)) {
                    return;
                }
                let slots = context.result.slots = context.result.slots || [];
                let attrsNode;
                if (node.nodes) {
                    for (let i = 0, nd; nd = node.nodes[i++]; ) {
                        if (nd.type === "Attributes") {
                            attrsNode = nd;
                            break;
                        }
                    }
                }
                if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                    if (slots.length) {
                        throw new Err(`missing attribute 'name' of tag <slot>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }
                    slots.push("");
                    nonameSlotNodes.push(node);
                    node.slotName = "";
                    return;
                }
                let ary = [];
                attrsNode.nodes && attrsNode.nodes.forEach(nd => {
                    /^name$/i.test(nd.object.name) && ary.push(nd);
                });
                if (ary.length === 0) {
                    if (slots.length) {
                        throw new Err(`missing attribute 'name' of tag <slot>`, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos,
                            end: object.loc.end.pos
                        });
                    }
                    slots.push("");
                    nonameSlotNodes.push(node);
                    node.slotName = "";
                    return;
                }
                if (ary.length > 1) {
                    throw new Err("duplicate attribute of name", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[1].object.loc.start.pos,
                        end: ary[1].object.loc.end.pos
                    });
                }
                if (bus.at("是否表达式", ary[0].object.value)) {
                    throw new Err("slot name unsupport the expression", {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                let name = ary[0].object.value + "";
                if (slots.includes(name)) {
                    throw new Err("duplicate slot name: " + name, {
                        file: context.input.file,
                        text: context.input.text,
                        start: ary[0].object.loc.start.pos,
                        end: ary[0].object.loc.end.pos
                    });
                }
                slots.push(name);
                !name && nonameSlotNodes.push(node);
                node.slotName = name;
            });
            let slots = context.result.slots = context.result.slots || [];
            if (slots.length > 1 && nonameSlotNodes.length) {
                throw new Err(`missing slot name on tag <slot>`, {
                    file: context.input.file,
                    text: context.input.text,
                    start: nonameSlotNodes[0].object.loc.start.pos,
                    end: nonameSlotNodes[0].object.loc.end.pos
                });
            }
            if (context.result.slots) {
                let statekeys = context.doc.api.statekeys = context.doc.api.statekeys || [];
                !statekeys.includes("$SLOT") && statekeys.push("$SLOT");
            }
            if (slots.length) {
                root.walk("Tag", (nd, obj) => {
                    if (!/^slot$/i.test(obj.value)) {
                        return;
                    }
                    let type = options.TypeCodeBlock;
                    let value = `${AryNm}.push( ...${SlotVnodes}_${hash(nd.slotName)} );`;
                    let loc = nd.object.loc;
                    nd.replaceWith(this.createNode({
                        type: type,
                        value: value
                    }));
                });
                let arySrc = [];
                let isNoNameSlot = slots.length === 1 && slots[0] === "" ? true : false;
                let aryVars = [];
                isNoNameSlot && aryVars.push(" _hasDefinedSlotTemplate ");
                slots.forEach(slotName => {
                    aryVars.push(` ${SlotVnodes}_${hash(slotName)} = [] `);
                });
                arySrc.push("let " + aryVars.join(",") + ";");
                arySrc.push(` ($state.$SLOT || []).forEach(vn => { `);
                arySrc.push(`     if (vn.a) { `);
                if (isNoNameSlot) {
                    arySrc.push(`     vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1); `);
                }
                slots.forEach(slotNm => {
                    arySrc.push(`     vn.a.slot === '${slotNm}' && (${SlotVnodes}_${hash(slotNm)} = vn.c || []); `);
                });
                arySrc.push(`     } `);
                arySrc.push(` }); `);
                if (isNoNameSlot) {
                    arySrc.push(` !_hasDefinedSlotTemplate && !${SlotVnodes}_${hash("")}.length && (${SlotVnodes}_${hash("")} = $state.$SLOT || []); `);
                }
                root.walk("View", (nd, obj) => {
                    let type = options.TypeCodeBlock;
                    let value = arySrc.join("\n");
                    nd.addChild(this.createNode({
                        type: type,
                        value: value
                    }), 0);
                    return false;
                });
            }
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("m15p-csslibify-check-@csslib", function(root, context) {
            let oCsslib = context.result.oCsslib;
            let oNameSet = new Set();
            root.walk("@csslib", (node, object) => {
                if (bus.at("是否表达式", object.value)) {
                    throw new Err("@csslib unsupport the expression", {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                let tmpAry = object.value.split("=");
                let libname = tmpAry.length > 1 ? tmpAry[0].trim() : "*";
                if (!libname) {
                    throw new Err("use * as empty csslib name. etc. * = " + tmpAry[1], {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                if (oCsslib[libname]) {
                    throw new Err("duplicate csslib name: " + libname, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                if (oNameSet.has(libname)) {
                    throw new Err("duplicate csslib name: " + libname, {
                        file: context.input.file,
                        text: context.input.text,
                        start: object.loc.start.pos,
                        end: object.loc.end.pos
                    });
                }
                oNameSet.add(libname);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("m17p-csslibify-gen-css-@csslib", function(root, context) {
            let style = context.style;
            let oCssSet = style.csslibset = style.csslibset || new Set();
            let oCsslib = Object.assign({}, context.result.oCsslib);
            let oCsslibPkgs = context.result.oCsslibPkgs;
            let hashClassName = bus.on("哈希样式类名")[0];
            let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? cls + "@" + pkg : cls);
            let opts = {
                rename: rename
            };
            let atcsslibtagcss = context.result.atcsslibtagcss = context.result.atcsslibtagcss || [];
            let ary, clsname, csslib, css;
            root.walk("Class", (node, object) => {
                let csslibNode;
                for (let i = 0, nd; nd = node.parent.nodes[i++]; ) {
                    if (nd.type === "@csslib") {
                        csslibNode = nd;
                        break;
                    }
                }
                if (csslibNode) {
                    let atcsslib = bus.at("样式库", csslibNode.object.value);
                    oCsslib[atcsslib.name] = atcsslib;
                    oCsslibPkgs[atcsslib.name] = atcsslib.pkg;
                    node.parent.object.standard && atcsslibtagcss.push(atcsslib.get(node.parent.object.value));
                }
                let nonameCsslib = oCsslib["*"];
                for (let i = 0, clspkg, clsname, asname; clspkg = object.classes[i++]; ) {
                    ary = clspkg.split("@");
                    clsname = "." + ary[0];
                    asname = ary.length > 1 ? ary[1] : "";
                    if (asname) {
                        csslib = oCsslib[asname];
                        if (!csslib) {
                            throw new Err("csslib not found: " + asname, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }
                        css = csslib.get(clsname, opts);
                        if (!css) {
                            throw new Err("css class not found: " + clsname, {
                                file: context.input.file,
                                text: context.input.text,
                                start: object.loc.start.pos,
                                end: object.loc.end.pos
                            });
                        }
                        oCssSet.add(css);
                    } else {
                        nonameCsslib && oCssSet.add(nonameCsslib.get(clsname, opts));
                    }
                }
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("n15p-astedit-remove-blank-text", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(OPTS.TypeText, (node, object) => {
                if (!/^\s*$/.test(object.value) || node.parent.object.name === "pre") {
                    return;
                }
                let nBefore = node.before();
                let nAfter = node.after();
                if (!nBefore || !nAfter || (nBefore.type === "Tag" || nAfter.type === "Tag") || (nBefore.type === OPTS.TypeHtmlComment || nAfter.type === OPTS.TypeHtmlComment) || (nBefore.type === OPTS.TypeCodeBlock || nAfter.type === OPTS.TypeCodeBlock)) {
                    node.remove();
                }
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("n25p-astedit-remove-html-comment", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(OPTS.TypeHtmlComment, (node, object) => {
                node.remove();
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("n35p-astedit-join-text-node", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(/^(Text|Expression)$/, (node, object) => {
                let ary = [ node ];
                let nAfter = node.after();
                while (nAfter && (nAfter.type === OPTS.TypeText || nAfter.type === OPTS.TypeExpression)) {
                    ary.push(nAfter);
                    nAfter = nAfter.after();
                }
                if (ary.length < 2) {
                    return;
                }
                let aryRs = [], tmp;
                ary.forEach(nd => {
                    if (nd.type === OPTS.TypeText) {
                        aryRs.push('"' + lineString(nd.object.value) + '"');
                    } else {
                        if (!isBlankOrCommentExpr(nd.object.value)) {
                            aryRs.push(nd.object.value.replace(/^\s*\{/, "(").replace(/\}\s*$/, ")"));
                        }
                    }
                });
                let value = OPTS.ExpressionStart + aryRs.join(" + ") + OPTS.ExpressionEnd;
                let start = ary[0].object.loc.start;
                let end = ary[ary.length - 1].object.loc.end;
                let loc = {
                    start: start,
                    end: end
                };
                let tNode = this.createNode({
                    type: OPTS.TypeExpression,
                    value: value,
                    loc: loc
                });
                node.before(tNode);
                ary.forEach(nd => nd.remove());
            });
        });
    }());
    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }
        let rs = str.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }
    function isBlankOrCommentExpr(code) {
        code = code.trim();
        if (code.startsWith("{") && code.endsWith("}")) {
            code = code.substring(1, code.length - 1).trim();
        }
        if (!code) {
            return true;
        }
        if (/^\/\/.*$/.test(code) && code.indexOf("\n") < 0) {
            return true;
        }
        if (!code.startsWith("/*") || !code.endsWith("*/")) {
            return false;
        }
        if (code.indexOf("*/") === code.length - 2) {
            return true;
        }
        return false;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("n45p-astedit-remove-jscode-blank-comment", function(root, context) {
            const OPTS = bus.at("视图编译选项");
            root.walk(OPTS.TypeCodeBlock, (node, object) => {
                if (isBlankOrComment(object.value)) {
                    node.remove();
                }
            });
        });
    }());
    function isBlankOrComment(code) {
        code = code.trim();
        if (!code) {
            return true;
        }
        if (/^\/\/.*$/.test(code) && code.indexOf("\n") < 0) {
            return true;
        }
        if (!code.startsWith("/*") || !code.endsWith("*/")) {
            return false;
        }
        if (code.indexOf("*/") === code.length - 2) {
            return true;
        }
        return false;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    class ClsTemplate {
        constructor(tmpl = "", argNm) {
            let fnParse = function(ary, tmpl, isPreCode) {
                let tmp, idx = tmpl.indexOf("<%");
                if (idx < 0) {
                    ary.push(fnText(ary, tmpl, isPreCode));
                } else if (idx == 0) {
                    if (tmpl.indexOf("<%=") == idx) {
                        tmpl = tmpl.substring(3);
                        idx = tmpl.indexOf("%>");
                        tmp = tmpl.substring(0, idx);
                        ary.push(ary.pop() + "+" + tmp);
                        fnParse(ary, tmpl.substring(idx + 2), false);
                    } else {
                        tmpl = tmpl.substring(2);
                        idx = tmpl.indexOf("%>");
                        tmp = tmpl.substring(0, idx);
                        isPreCode ? ary.push(tmp) : ary.push(ary.pop() + ";") && ary.push(tmp);
                        fnParse(ary, tmpl.substring(idx + 2), true);
                    }
                } else {
                    tmp = tmpl.substring(0, idx);
                    ary.push(fnText(ary, tmp, isPreCode));
                    fnParse(ary, tmpl.substring(idx), false);
                }
            };
            let fnText = function(ary, txt, isPreCode) {
                let str = txt.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\'/g, "\\'");
                return isPreCode ? "s+='" + str + "'" : ary.pop() + "+'" + str + "'";
            };
            let aryBody = [];
            aryBody.push("let s=''");
            fnParse(aryBody, tmpl, true);
            aryBody.push("return s");
            this.toString = argNm ? new Function(argNm, aryBody.join("\n")) : new Function(aryBody.join("\n"));
        }
    }
    bus.on("编译模板JS", function(result) {
        return function() {
            if (!result) {
                let tmpl = getSrcTemplate().replace(/\\/g, "\\\\");
                let clsTemplate = new ClsTemplate(tmpl, "$data");
                result = clsTemplate.toString;
            }
            return result;
        };
    }());
    function getSrcTemplate() {
        return `\n\n// ------------------------------------------------------------------------------------------------------\n// 组件 <%= $data['COMPONENT_NAME'] %>\n// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接调用方法或用new创建\n// ------------------------------------------------------------------------------------------------------\n<% if ( $data['singleton'] ){ %>\n    // 这是个单例组件\n    <%= $data['COMPONENT_NAME'] %>.Singleton = true;\n<% } %>\n\n// 属性接口定义\n<%= $data['COMPONENT_NAME'] %>.prototype.$OPTION_KEYS = <%= JSON.stringify($data['optionkeys']) %>;  // 可通过标签配置的属性，未定义则不支持外部配置\n<%= $data['COMPONENT_NAME'] %>.prototype.$STATE_KEYS = <%= JSON.stringify($data['statekeys']) %>;    // 可更新的state属性，未定义则不支持外部更新state\n\n// 组件函数\nfunction <%= $data['COMPONENT_NAME'] %>(options={}) {\n\n    <% if ( $data['optionkeys'] != null ){ %>\n    // 组件默认选项值\n    this.$options = <%= $data['options'] %>;\n    rpose.extend(this.$options, options, this.$OPTION_KEYS);    // 按属性接口克隆配置选项\n    <% }else{ %>\n    // 组件默认选项值\n    this.$options = <%= $data['options'] %>;\n    <% } %>\n\n    <% if ( $data['statekeys'] != null ){ %>\n    // 组件默认数据状态值\n    this.$state = <%= $data['state'] %>;\n    rpose.extend(this.$state, options, this.$STATE_KEYS);       // 按属性接口克隆数据状态\n    <% }else{ %>\n    // 组件默认数据状态值\n    this.$state = <%= $data['state'] %>;\n    <% } %>\n\n    <% if ( $data['actions'] ){ %>\n    // 事件处理器\n    <%= $data['actions'] %>\n    <% } %>\n\n    <% if ( $data['methods'] ){ %>\n    // 自定义方法\n    <%= $data['methods'] %>;\n    <% } %>\n\n    <% if ( $data['updater'] ){ %>\n    // 组件更新函数\n    this.$updater = <%= $data['updater'] %>;\n    <% } %>\n}\n\n/**\n * 节点模板函数\n */\n<%= $data['COMPONENT_NAME'] %>.prototype.nodeTemplate = <%= $data['vnodeTemplate'] %>\n\n`;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    bus.on("表达式代码转换", function() {
        return function(expression) {
            let expr = expression.trim();
            expr.startsWith("{") && expr.endsWith("}") && (expr = expr.substring(1, expr.length - 1));
            return `(${expr})`;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    bus.on("astgen-node-text", function() {
        return function(node, context) {
            const OPTS = bus.at("视图编译选项");
            if (node.type === OPTS.TypeText) {
                return textJsify(node, context);
            } else if (node.type === OPTS.TypeExpression) {
                return expressionJsify(node, context);
            }
            return "";
        };
    }());
    function textJsify(node, context) {
        let obj = node.object;
        let ary = [];
        let text = '"' + lineString(obj.value) + '"';
        ary.push(`{ `);
        ary.push(`  s: ${text} `);
        ary.push(` ,k: ${context.keyCounter++} `);
        ary.push(`}`);
        return ary.join("\n");
    }
    function expressionJsify(node, context) {
        let obj = node.object;
        let ary = [];
        let text = obj.value.replace(/^\s*\{/, "(").replace(/\}\s*$/, ")");
        ary.push(`{ `);
        ary.push(`  s: ${text} `);
        ary.push(` ,k: ${context.keyCounter++} `);
        ary.push(`}`);
        return ary.join("\n");
    }
    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }
        let rs = str.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("p15p-reference-components", function(root, context) {
            let result = context.result;
            let oSet = new Set();
            root.walk("Tag", (node, object) => {
                if (!object.standard) {
                    oSet.add(object.value);
                    let file = bus.at("标签源文件", object.value);
                    if (!file) {
                        throw new Err("file not found of tag: " + object.value, {
                            file: context.input.file,
                            text: context.input.text,
                            start: object.loc.start.pos
                        });
                    }
                }
            }, {
                readonly: true
            });
            result.references = [ ...oSet ];
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("p17p-components-reference-standard-tags", function(root, context) {
            let result = context.result;
            let oSet = new Set();
            root.walk("Tag", (node, object) => {
                if (object.standard) {
                    oSet.add(object.value);
                }
            }, {
                readonly: true
            });
            result.standardtags = [ ...oSet ];
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const REG_EVENTS = /^(onclick|onchange|onabort|onafterprint|onbeforeprint|onbeforeunload|onblur|oncanplay|oncanplaythrough|oncontextmenu|oncopy|oncut|ondblclick|ondrag|ondragend|ondragenter|ondragleave|ondragover|ondragstart|ondrop|ondurationchange|onemptied|onended|onerror|onfocus|onfocusin|onfocusout|onformchange|onforminput|onhashchange|oninput|oninvalid|onkeydown|onkeypress|onkeyup|onload|onloadeddata|onloadedmetadata|onloadstart|onmousedown|onmouseenter|onmouseleave|onmousemove|onmouseout|onmouseover|onmouseup|onmousewheel|onoffline|ononline|onpagehide|onpageshow|onpaste|onpause|onplay|onplaying|onprogress|onratechange|onreadystatechange|onreset|onresize|onscroll|onsearch|onseeked|onseeking|onselect|onshow|onstalled|onsubmit|onsuspend|ontimeupdate|ontoggle|onunload|onunload|onvolumechange|onwaiting|onwheel)$/i;
    bus.on("astgen-node-attributes", function() {
        return function(tagNode, context) {
            if (!tagNode.nodes) {
                return "";
            }
            let attrsNode;
            for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                if (nd.type === "Attributes") {
                    attrsNode = nd;
                    break;
                }
            }
            if (!attrsNode || !attrsNode.nodes || !attrsNode.nodes.length) {
                return "";
            }
            let key, value, comma = "", ary = [];
            ary.push(`{ `);
            attrsNode.nodes.forEach(node => {
                key = '"' + lineString(node.object.name) + '"';
                if (node.object.isExpression) {
                    value = bus.at("表达式代码转换", node.object.value);
                } else if (typeof node.object.value === "string") {
                    if (!tagNode.object.standard && REG_EVENTS.test(node.object.name) && !node.object.isExpression && context.script.$actionkeys) {
                        let val = node.object.value.trim();
                        let fnNm = val.startsWith("$actions.") ? val.substring(9) : val;
                        if (context.script.$actionkeys.includes(fnNm)) {
                            value = `$actions['${fnNm}']`;
                        } else {
                            value = '"' + lineString(node.object.value) + '"';
                        }
                    } else {
                        value = '"' + lineString(node.object.value) + '"';
                    }
                } else {
                    value = node.object.value;
                }
                ary.push(` ${comma} ${key}: ${value} `);
                !comma && (comma = ",");
            });
            ary.push(` } `);
            return ary.join("\n");
        };
    }());
    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }
        let rs = str.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    bus.on("astgen-node-events", function() {
        return function(tagNode, context) {
            if (!tagNode.nodes) {
                return "";
            }
            let eventsNode;
            for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                if (nd.type === "Events") {
                    eventsNode = nd;
                    break;
                }
            }
            if (!eventsNode || !eventsNode.nodes || !eventsNode.nodes.length) {
                return "";
            }
            let key, value, comma = "", ary = [];
            ary.push(`{ `);
            eventsNode.nodes.forEach(node => {
                key = node.object.name.substring(2);
                value = node.object.value;
                if (node.object.isExpression) {
                    value = bus.at("表达式代码转换", value);
                } else {
                    value = value.trim();
                    let fnNm = value.startsWith("$actions.") ? value.substring(9) : value;
                    if (context.script.$actionkeys && context.script.$actionkeys.includes(fnNm)) {
                        value = "$actions." + value;
                    } else {
                        throw new Err("action not found: " + fnNm, {
                            file: context.input.file,
                            text: context.input.text,
                            start: node.object.loc.start.pos,
                            end: node.object.loc.end.pos
                        });
                    }
                }
                ary.push(` ${comma} ${key}: ${value} `);
                !comma && (comma = ",");
            });
            ary.push(` } `);
            return ary.join("\n");
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    bus.on("astgen-node-style", function() {
        return function(tagNode, context) {
            if (!tagNode.nodes) {
                return "";
            }
            let styleNode;
            for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                if (nd.type === "Style") {
                    styleNode = nd;
                    break;
                }
            }
            if (!styleNode || !styleNode.object.value) {
                return "";
            }
            if (!styleNode.object.isExpression) {
                return '"' + lineString(styleNode.object.value) + '"';
            }
            let ary = [];
            parseExpression(ary, styleNode.object.value);
            return "(" + ary.join(" + ") + ")";
        };
    }());
    function parseExpression(ary, val) {
        if (/^\{\s*\{[\s\S]*?\}\s*\}$/.test(val)) {
            ary.push(val.replace(/^\{/, "").replace(/\}$/, ""));
            return;
        }
        let idxStart = val.indexOf("{");
        if (idxStart < 0) {
            ary.push('"' + lineString(val) + '"');
            return;
        }
        let idxEnd = val.indexOf("}", idxStart);
        if (idxEnd < 0) {
            ary.push('"' + lineString(val) + '"');
            return;
        }
        if (idxStart > 0) {
            ary.push('"' + lineString(val.substring(0, idxStart)) + '"');
        }
        ary.push("(" + val.substring(idxStart + 1, idxEnd) + ")");
        let tmp = val.substring(idxEnd + 1);
        tmp && parseExpression(ary, tmp);
    }
    function lineString(str, quote = '"') {
        if (str == null) {
            return str;
        }
        let rs = str.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
        if (quote == '"') {
            rs = rs.replace(/"/g, '\\"');
        } else if (quote == "'") {
            rs = rs.replace(/'/g, "\\'");
        }
        return rs;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    bus.on("astgen-node-class", function() {
        return function(tagNode, context) {
            if (!tagNode.nodes) {
                return "";
            }
            let classNode;
            for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                if (nd.type === "Class") {
                    classNode = nd;
                    break;
                }
            }
            if (!classNode || !classNode.object.value) {
                return "";
            }
            return classStrToObjectString(classNode.object.value, context);
        };
    }());
    function classStrToObjectString(clas, context) {
        let oCsslibPkgs = context.result.oCsslibPkgs;
        let oRs = {};
        clas = clas.replace(/\{.*?\}/g, function(match) {
            let str = match.substring(1, match.length - 1);
            let idx, cls, expr;
            while (str.indexOf(":") > 0) {
                idx = str.indexOf(":");
                cls = str.substring(0, idx).replace(/['"]/g, "");
                expr = str.substring(idx + 1);
                let idx2 = expr.indexOf(":");
                if (idx2 > 0) {
                    expr = expr.substring(0, idx2);
                    expr = expr.substring(0, expr.lastIndexOf(","));
                    str = str.substring(idx + 1 + expr.length + 1);
                } else {
                    str = "";
                }
                oRs[bus.at("哈希样式类名", context.input.file, getClassPkg(cls, oCsslibPkgs))] = "@(" + expr + ")@";
            }
            return "";
        });
        let ary = clas.split(/\s/);
        for (let i = 0; i < ary.length; i++) {
            ary[i].trim() && (oRs[bus.at("哈希样式类名", context.input.file, getClassPkg(ary[i], oCsslibPkgs))] = 1);
        }
        return JSON.stringify(oRs).replace(/('@|@'|"@|@")/g, "");
    }
    function getClassPkg(cls, oCsslibPkgs) {
        let ary = cls.trim().split("@");
        if (ary.length > 1) {
            return ary[0] + "@" + oCsslibPkgs[ary[1]];
        }
        return ary[0];
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    bus.on("astgen-node-{prop}", function() {
        return function(tagNode, context) {
            if (!tagNode.nodes) {
                return "";
            }
            let exprAttrNode;
            for (let i = 0, nd; nd = tagNode.nodes[i++]; ) {
                if (nd.type === "ObjectExpressionAttributes") {
                    exprAttrNode = nd;
                    break;
                }
            }
            if (!exprAttrNode || !exprAttrNode.nodes || !exprAttrNode.nodes.length) {
                return "";
            }
            let prop, ary = [];
            exprAttrNode.nodes.forEach(node => {
                prop = node.object.name.replace(/^\s*\{=?/, "(").replace(/\}\s*$/, ")");
                ary.push(prop);
            });
            return ary.join(",");
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    bus.on("astgen-node-tag", function() {
        return tagJsify;
    }());
    function tagJsify(node, context) {
        if (node.type !== "Tag") {
            return "";
        }
        let obj = node.object;
        let isTop = node.parent.type === "View";
        let isStatic = isStaticTagNode(node);
        let isComponent = !node.object.standard;
        let childrenJs = bus.at("astgen-node-tag-nodes", node.nodes, context);
        let attrs = bus.at("astgen-node-attributes", node, context);
        let events = bus.at("astgen-node-events", node, context);
        let isSvg = node.object.svg;
        let style = bus.at("astgen-node-style", node, context);
        if (style) {
            if (!attrs) {
                attrs = `{style: ${style}}`;
            } else {
                attrs = attrs.replace(/\}\s*$/, `,style: ${style}}`);
            }
        }
        let clasz = bus.at("astgen-node-class", node, context);
        if (clasz) {
            if (!attrs) {
                attrs = `{class: ${clasz}}`;
            } else {
                attrs = attrs.replace(/\}\s*$/, `,class: ${clasz}}`);
            }
        }
        let props = bus.at("astgen-node-{prop}", node, context);
        if (props) {
            attrs = `rpose.assign( ${attrs}, ${props})`;
        }
        let ary = [];
        ary.push(`{ `);
        ary.push(`  t: '${obj.value}' `);
        isTop && ary.push(` ,r: 1 `);
        isStatic && ary.push(` ,x: 1 `);
        isComponent && ary.push(` ,m: 1 `);
        isSvg && ary.push(` ,g: 1 `);
        ary.push(` ,k: ${context.keyCounter++} `);
        childrenJs && ary.push(` ,c: ${childrenJs} `);
        attrs && ary.push(` ,a: ${attrs} `);
        events && ary.push(` ,e: ${events} `);
        ary.push(`}`);
        return ary.join("\n");
    }
    function isStaticTagNode(node) {
        return false;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const Err = require("@gotoeasy/err");
    const AryName = "_Ary";
    bus.on("astgen-node-tag-nodes", function() {
        return nodesJsify;
    }());
    function nodesJsify(nodes = [], context) {
        if (!nodes.length) {
            return "";
        }
        return hasCodeBolck(nodes) ? nodesWithScriptJsify(nodes, context) : nodesWithoutScriptJsify(nodes, context);
    }
    function nodesWithScriptJsify(nodes = [], context) {
        let ary = [], src;
        ary.push(` ((${AryName}) => { `);
        for (let i = 0, node; node = nodes[i++]; ) {
            if (node.type === "JsCode") {
                ary.push(node.object.value);
            } else if (src = bus.at("astgen-node-tag", node, context)) {
                ary.push(` ${AryName}.push( ${src} ); `);
            } else if (src = bus.at("astgen-node-text", node, context)) {
                ary.push(` ${AryName}.push( ${src} ); `);
            } else if (node.type === "Attributes" || node.type === "Events" || node.type === "ObjectExpressionAttributes") {} else if (node.type === "Class" || node.type === "Style") {} else {
                throw new Err("unhandle node type: " + node.type);
            }
        }
        ary.push(` return ${AryName}; `);
        ary.push(` })([]) `);
        return ary.join("\n");
    }
    function nodesWithoutScriptJsify(nodes = [], context) {
        let src, ary = [];
        nodes.forEach(node => {
            src = bus.at("astgen-node-tag", node, context);
            src && ary.push(src);
            src = bus.at("astgen-node-text", node, context);
            src && ary.push(src);
        });
        return "[" + ary.join(",\n") + "]";
    }
    function hasCodeBolck(nodes) {
        for (let i = 0, node; node = nodes[i++]; ) {
            if (node.type === "JsCode") {
                return true;
            }
        }
        return false;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");
    class JsWriter {
        constructor() {
            this.ary = [];
        }
        push(src) {
            src !== undefined && this.ary.push(src);
        }
        write(src) {
            src !== undefined && this.ary.push(src);
        }
        out(file) {
            File.write(file, this.toString());
        }
        getArray() {
            return this.ary;
        }
        toString() {
            let js = this.ary.join("\n");
            try {
                return csjs.formatJs(js);
            } catch (e) {
                File.write(process.cwd() + "/build/error/format-error.js", js);
                throw e;
            }
        }
    }
    bus.on("编译插件", function() {
        return postobject.plugin("s15p-component-ast-jsify-writer", function(root, context) {
            context.writer = new JsWriter();
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");
    const AryNm = "v_Array";
    bus.on("编译插件", function() {
        return postobject.plugin("s25p-component-ast-jsify-root", function(root, context) {
            let writer = context.writer;
            let script = context.script;
            root.walk("View", (node, object) => {
                if (!node.nodes || node.nodes.length < 1) {
                    return writer.write("// 没有节点，无可生成");
                }
                writer.write("function nodeTemplate($state, $options, $actions, $this) {");
                if (hasCodeBolck(node.nodes)) {
                    writer.write(`${topNodesWithScriptJsify(node.nodes, context)}`);
                } else {
                    writer.write(`${topNodesWithoutScriptJsify(node.nodes, context)}`);
                }
                writer.write("}");
                script.vnodeTemplate = writer.toString();
                return false;
            });
        });
    }());
    function topNodesWithScriptJsify(nodes = [], context) {
        let ary = [], src;
        ary.push(` let ${AryNm} = []; `);
        for (let i = 0, node; node = nodes[i++]; ) {
            if (node.type === "JsCode") {
                ary.push(node.object.value);
            } else if (src = bus.at("astgen-node-tag", node, context)) {
                ary.push(` ${AryNm}.push( ${src} ); `);
            } else if (src = bus.at("astgen-node-text", node, context)) {
                ary.push(` ${AryNm}.push( ${src} ); `);
            } else {
                throw new Err("unhandle node type");
            }
        }
        ary.push(` ${AryNm}.length > 1 && console.warn("invlid tag count"); `);
        ary.push(` return ${AryNm}.length ? v_Array[0] : null; `);
        return ary.join("\n");
    }
    function topNodesWithoutScriptJsify(nodes = [], context) {
        if (nodes.length > 1) {
            let text = context.input.text;
            let file = context.input.file;
            let start = nodes[1].object.loc.start.pos;
            nodes[0].type !== "Tag" && (start = nodes[0].object.loc.start.pos);
            throw new Err("invalid top tag", {
                text: text,
                file: file,
                start: start
            });
        }
        let src, node = nodes[0];
        if (node.type !== "Tag") {
            let text = context.input.text;
            let file = context.input.file;
            let start = nodes[0].object.loc.start.pos;
            throw new Err("missing top tag", {
                text: text,
                file: file,
                start: start
            });
        }
        src = bus.at("astgen-node-tag", node, context);
        if (src) {
            return `return ${src}`;
        }
        src = bus.at("astgen-node-text", node, context);
        if (src) {
            return `return ${src}`;
        }
        throw new Err("unhandle node type");
    }
    function hasCodeBolck(nodes) {
        for (let i = 0, node; node = nodes[i++]; ) {
            if (node.type === "JsCode") {
                return true;
            }
        }
        return false;
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const hash = require("@gotoeasy/hash");
    const acorn = require("acorn");
    const walk = require("acorn-walk");
    const astring = require("astring");
    const tokenizer = require("css-selector-tokenizer");
    bus.on("编译插件", function() {
        return postobject.plugin("s35p-component-script-selector-rename", function(root, context) {
            let oCsslibPkgs = context.result.oCsslibPkgs;
            let script = context.script;
            let reg = /(\.getElementsByClassName\s*\(|\.querySelector\s*\(|\.querySelectorAll\s*\(|\$\$\s*\(|\$\s*\()/;
            if (script.actions && reg.test(script.actions)) {
                script.actions = transformJsSelector(script.actions, context.input.file);
            }
            if (script.methods && reg.test(script.methods)) {
                script.methods = transformJsSelector(script.methods, context.input.file);
            }
            function transformJsSelector(code, srcFile) {
                let ast, changed;
                try {
                    ast = acorn.parse(code, {
                        ecmaVersion: 10,
                        sourceType: "module",
                        locations: false
                    });
                } catch (e) {
                    throw new Err("syntax error", e);
                }
                walk.simple(ast, {
                    CallExpression(node) {
                        if (!node.arguments || node.arguments[0].type !== "Literal") {
                            return;
                        }
                        let fnName = node.callee.name || node.callee.property.name;
                        if (!/^(getElementsByClassName|querySelector|querySelectorAll|\$\$)$/.test(fnName)) {
                            return;
                        }
                        if (fnName === "getElementsByClassName") {
                            node.arguments[0].value = bus.at("哈希样式类名", srcFile, getClassPkg(node.arguments[0].value));
                        } else {
                            node.arguments[0].value = transformSelector(node.arguments[0].value, srcFile);
                        }
                        node.arguments[0].raw = `'${node.arguments[0].value}'`;
                        changed = true;
                    }
                });
                return changed ? astring.generate(ast) : code;
            }
            function transformSelector(selector, srcFile) {
                selector = selector.replace(/@/g, "鬱");
                let ast = tokenizer.parse(selector);
                let nodes = ast.nodes || [];
                nodes.forEach(node => {
                    if (node.type === "selector") {
                        (node.nodes || []).forEach(nd => {
                            if (nd.type === "class") {
                                nd.name = bus.at("哈希样式类名", srcFile, getClassPkg(nd.name));
                            }
                        });
                    }
                });
                let rs = tokenizer.stringify(ast);
                return rs.replace(/鬱/g, "@");
            }
            function getClassPkg(cls) {
                let ary = cls.trim().split("鬱");
                if (ary.length > 1) {
                    let asname = ary[1];
                    if (!oCsslibPkgs[asname]) {
                        throw new Error("csslib not found: " + ary[0] + "@" + ary[1] + "\nfile: " + context.input.file);
                    }
                    return ary[0] + "@" + asname;
                }
                return ary[0];
            }
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const acornGlobals = require("acorn-globals");
    const JS_VARS = "$$,require,window,location,clearInterval,setInterval,assignOptions,rpose,$SLOT,Object,Map,Set,WeakMap,WeakSet,Date,Math,Array,String,Number,JSON,Error,Function,arguments,Boolean,Promise,Proxy,Reflect,RegExp,alert,console,window,document".split(",");
    bus.on("编译插件", function() {
        return postobject.plugin("s45p-component-gen-js", function(root, context) {
            let env = bus.at("编译环境");
            let result = context.result;
            let script = context.script;
            let writer = context.writer;
            let fnTmpl = bus.at("编译模板JS");
            let $data = {};
            $data.COMPONENT_NAME = bus.at("组件类名", context.input.file);
            $data.options = context.doc.options || "{}";
            $data.state = context.doc.state || "{}";
            if (context.doc.api) {
                $data.optionkeys = context.doc.api.optionkeys;
                $data.statekeys = context.doc.api.statekeys;
            }
            $data.actions = script.actions;
            $data.methods = script.methods;
            $data.updater = script.updater;
            $data.vnodeTemplate = script.vnodeTemplate;
            result.componentJs = fnTmpl($data);
            result.componentJs = checkAndInitVars(result.componentJs, context);
            if (!env.release) {
                let fileJs = env.path.build_temp + "/" + bus.at("组件目标文件名", context.input.file) + ".js";
                File.write(fileJs, csjs.formatJs(result.componentJs));
            }
        });
    }());
    function checkAndInitVars(src, context) {
        let optionkeys = context.doc.api.optionkeys || [];
        let statekeys = context.doc.api.statekeys || [];
        let scopes;
        try {
            scopes = acornGlobals(src);
            if (!scopes.length) {
                return src;
            }
        } catch (e) {
            throw Err.cat("source syntax error", "\n-----------------", src, "\n-----------------", "file=" + context.input.file, e);
        }
        let vars = [];
        for (let i = 0, v; i < scopes.length; i++) {
            v = scopes[i];
            let inc$opts = optionkeys.includes(v.name);
            let inc$state = statekeys.includes(v.name);
            let incJsVars = JS_VARS.includes(v.name);
            if (!inc$opts && !inc$state && !incJsVars) {
                let msg = "template variable undefined: " + v.name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg);
            }
            if (inc$opts && inc$state) {
                let msg = "template variable uncertainty: " + v.name;
                msg += "\n  file: " + context.input.file;
                throw new Err(msg);
            }
            if (inc$state) {
                vars.push(`let ${v.name} = $state.${v.name};`);
            } else if (inc$opts) {
                vars.push(`let ${v.name} = $options.${v.name};`);
            }
        }
        return src.replace(/(\n.+?prototype\.nodeTemplate\s*=\s*function\s+.+?\r?\n)/, "$1" + vars.join("\n"));
    }
})();

(() => {
    const Err = require("@gotoeasy/err");
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    const postcss = require("postcss");
    const tokenizer = require("css-selector-tokenizer");
    bus.on("组件样式类名哈希化", function() {
        return function(srcFile, css) {
            let fnPostcssPlugin = (root, result) => {
                root.walkRules(rule => {
                    let ast = tokenizer.parse(rule.selector);
                    let nodes = ast.nodes || [];
                    nodes.forEach(node => {
                        if (node.type === "selector") {
                            (node.nodes || []).forEach(nd => {
                                if (nd.type === "class") {
                                    nd.name = bus.at("哈希样式类名", srcFile, nd.name);
                                }
                            });
                        }
                    });
                    rule.selector = tokenizer.stringify(ast);
                });
            };
            let rs = postcss([ fnPostcssPlugin ]).process(css, {
                from: "from.css"
            }).sync().root.toResult();
            return rs.css;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const File = require("@gotoeasy/file");
    const csjs = require("@gotoeasy/csjs");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("s55p-component-gen-css", function(root, context) {
            let style = context.style;
            let ary = [];
            style.csslibset && ary.push(...style.csslibset);
            style.less && ary.push(style.less);
            style.scss && ary.push(style.scss);
            style.css && ary.push(style.css);
            context.result.css = bus.at("组件样式类名哈希化", context.input.file, ary.join("\n"));
            let env = bus.at("编译环境");
            let file = env.path.build_temp + "/" + bus.at("组件目标文件名", context.input.file) + ".css";
            if (!env.release) {
                if (context.result.css) {
                    File.write(file, context.result.css);
                } else {
                    File.remove(file);
                }
            }
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("w15p-component-complie-result-cache", function(root, context) {
            bus.at("组件编译缓存", context.input.file, context);
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("y15p-page-all-reference-components", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let oSetAllRef = new Set();
            let oStatus = {};
            let references = context.result.references;
            references.forEach(tagpkg => {
                addRefComponent(tagpkg, oSetAllRef, oStatus);
            });
            if (oSetAllRef.has(context.result.tagpkg)) {
                throw new Err("circular reference: " + context.result.tagpkg);
            }
            let allreferences = [ ...oSetAllRef ];
            allreferences.sort();
            allreferences.push(context.result.tagpkg);
            context.result.allreferences = allreferences;
        });
    }());
    function addRefComponent(tagpkg, oSetAllRequires, oStatus) {
        if (oStatus[tagpkg]) {
            return;
        }
        oSetAllRequires.add(tagpkg);
        oStatus[tagpkg] = true;
        let srcFile = bus.at("标签源文件", tagpkg);
        let context = bus.at("组件编译缓存", srcFile);
        if (!context) {
            context = bus.at("编译组件", srcFile);
        }
        let references = context.result.references;
        references.forEach(subTagpkg => {
            addRefComponent(subTagpkg, oSetAllRequires, oStatus);
        });
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("y17p-page-all-reference-standard-tags", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let oSetAllTag = new Set();
            context.result.standardtags.forEach(tag => oSetAllTag.add(tag));
            let references = context.result.references;
            references.forEach(tagpkg => {
                let srcFile = bus.at("标签源文件", tagpkg);
                let ctx = bus.at("组件编译缓存", srcFile);
                !ctx && (ctx = bus.at("编译组件", srcFile));
                let standardtags = ctx.result.standardtags;
                standardtags.forEach(tag => oSetAllTag.add(tag));
            });
            let allstandardtags = [ ...oSetAllTag ];
            allstandardtags.sort();
            context.result.allstandardtags = allstandardtags;
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const hash = require("@gotoeasy/hash");
    const postcss = require("postcss");
    bus.on("页面样式后处理", function() {
        return (css, srcFile) => {
            if (!css) {
                return "";
            }
            let env = bus.at("编译环境");
            let oCache = bus.at("缓存");
            let from = oCache.path + "/resources/from.css";
            let to = bus.at("页面目标CSS文件名", srcFile);
            let pageCss;
            let plugins = [];
            let url = "copy";
            let basePath = bus.at("缓存资源目录数组");
            let useHash = false;
            let assetsPath = bus.at("页面图片相对路径", srcFile);
            let postcssUrlOpt = {
                url: url,
                basePath: basePath,
                assetsPath: assetsPath,
                useHash: useHash
            };
            let cacheKey = JSON.stringify([ "页面样式后处理", bus.at("browserslist"), env.release, assetsPath, css ]);
            if (!env.nocache) {
                let cacheValue = oCache.get(cacheKey);
                if (cacheValue) {
                    if (cacheValue.indexOf("url(") > 0) {
                        plugins.push(require("postcss-url")(postcssUrlOpt));
                        postcss(plugins).process(css, {
                            from: from,
                            to: to
                        }).sync().root.toResult();
                    }
                    return cacheValue;
                }
            }
            plugins.push(require("postcss-discard-comments")({
                remove: x => 1
            }));
            plugins.push(require("postcss-normalize-whitespace"));
            plugins.push(require("postcss-discard-empty"));
            plugins.push(require("postcss-discard-duplicates"));
            plugins.push(require("autoprefixer")());
            plugins.push(require("postcss-url")(postcssUrlOpt));
            plugins.push(require("postcss-merge-rules")());
            let rs = postcss(plugins).process(css, {
                from: from,
                to: to
            }).sync().root.toResult();
            pageCss = env.release ? rs.css : csjs.formatCss(rs.css);
            return oCache.set(cacheKey, pageCss);
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    const hash = require("@gotoeasy/hash");
    bus.on("编译插件", function() {
        return postobject.plugin("y25p-page-gen-css-link-components", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let aryTagCss = [];
            let oCsslib = context.result.oCsslib;
            let oCache = bus.at("缓存");
            for (let k in oCsslib) {
                let cacheKey = hash(JSON.stringify([ "按需取标签样式", oCsslib[k].pkg, oCsslib[k].version, oCsslib[k]._imported, context.result.allstandardtags ]));
                if (!env.nocache) {
                    let cacheValue = oCache.get(cacheKey);
                    if (cacheValue) {
                        aryTagCss.push(cacheValue);
                    } else {
                        let tagcss = oCsslib[k].get(...context.result.allstandardtags);
                        aryTagCss.push(tagcss);
                        oCache.set(cacheKey, tagcss);
                    }
                } else {
                    let tagcss = oCsslib[k].get(...context.result.allstandardtags);
                    aryTagCss.push(tagcss);
                    oCache.set(cacheKey, tagcss);
                }
            }
            let ary = [];
            let allreferences = context.result.allreferences;
            allreferences.forEach(tagpkg => {
                let ctx = bus.at("组件编译缓存", bus.at("标签源文件", tagpkg));
                if (!ctx) {
                    ctx = bus.at("编译组件", tagpkg);
                }
                ctx.result.atcsslibtagcss && aryTagCss.push(...ctx.result.atcsslibtagcss);
                ctx.result.css && ary.push(ctx.result.css);
            });
            context.result.css = [ ...aryTagCss, ...ary ].join("\n");
            context.result.pageCss = bus.at("页面样式后处理", context.result.css, context.input.file);
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    bus.on("编译插件", function() {
        return postobject.plugin("y35p-page-gen-html", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let srcPath = env.path.src;
            let file = context.input.file;
            let name = File.name(file);
            let type = context.doc.api.prerender;
            let nocss = !context.result.pageCss;
            context.result.html = require(env.prerender)({
                srcPath: srcPath,
                file: file,
                name: name,
                type: type,
                nocss: nocss
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const resolvepkg = require("resolve-pkg");
    bus.on("RPOSE运行时代码", function(src) {
        return function() {
            if (!src) {
                let file = File.resolve(resolvepkg("@rpose/runtime", {
                    cwd: __dirname
                }), "runtime.js");
                src = File.read(file);
            }
            return src;
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const fs = require("fs");
    bus.on("编译插件", function() {
        return postobject.plugin("y55p-page-gen-js-link-runtime-components", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let allreferences = context.result.allreferences;
            let srcRuntime = bus.at("RPOSE运行时代码");
            let srcStmt = getSrcRegisterComponents(allreferences);
            let srcComponents = getSrcComponents(allreferences);
            let oCache = bus.at("缓存");
            let resourcePath = oCache.path + "/resources";
            let imgPath = bus.at("页面图片相对路径", context.input.file);
            srcComponents = srcComponents.replace(/\%imagepath\%([0-9a-z]+\.[0-9a-zA-Z]+)/g, function(match, filename) {
                let from = resourcePath + "/" + filename;
                let to = env.path.build_dist + "/" + (env.path.build_dist_images ? env.path.build_dist_images + "/" : "") + filename;
                File.existsFile(from) && !File.existsFile(to) && File.mkdir(to) > fs.copyFileSync(from, to);
                return imgPath + filename;
            });
            let tagpkg = context.result.tagpkg;
            let src = `\n                ${srcRuntime}\n\n                (function($$){\n                    // 组件注册\n                    ${srcStmt}\n\n                    ${srcComponents}\n\n                    // 组件挂载\n                    rpose.mount( rpose.newComponentProxy('${tagpkg}').render(), '${context.doc.mount}' );\n                })(rpose.$$);\n            `;
            context.result.pageJs = src;
        });
    }());
    function getSrcRegisterComponents(allreferences) {
        try {
            let obj = {};
            for (let i = 0, tagpkg, key, file; tagpkg = allreferences[i++]; ) {
                key = "'" + tagpkg + "'";
                file = bus.at("标签源文件", tagpkg);
                if (!File.exists(file)) {
                    throw new Err("component not found (tag = " + tagpkg + ")");
                }
                obj[key] = bus.at("组件类名", file);
            }
            return `rpose.registerComponents(${JSON.stringify(obj).replace(/"/g, "")});`;
        } catch (e) {
            throw Err.cat(MODULE + "gen register stmt failed", allreferences, e);
        }
    }
    function getSrcComponents(allreferences) {
        try {
            let ary = [];
            for (let i = 0, tagpkg, context; tagpkg = allreferences[i++]; ) {
                context = bus.at("组件编译缓存", bus.at("标签源文件", tagpkg));
                if (!context) {
                    context = bus.at("编译组件", tagpkg);
                }
                ary.push(context.result.componentJs);
            }
            return ary.join("\n");
        } catch (e) {
            throw Err.cat(MODULE + "get component src failed", allreferences, e);
        }
    }
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("y65p-page-gen-js-babel", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let oCache = bus.at("缓存");
            let cacheKey = JSON.stringify([ "page-gen-js-babel", bus.at("browserslist"), context.result.pageJs ]);
            if (!env.nocache) {
                let cacheValue = oCache.get(cacheKey);
                if (cacheValue) {
                    return context.result.babelJs = cacheValue;
                }
            }
            try {
                context.result.babelJs = csjs.babel(context.result.pageJs);
                oCache.set(cacheKey, context.result.babelJs);
            } catch (e) {
                File.write(env.path.build + "/error/babel.log", context.result.pageJs + "\n\n" + e.stack);
                throw e;
            }
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("y75p-page-gen-js-browserify-minformat", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let oCache = bus.at("缓存");
            let cacheKey = JSON.stringify([ "page-gen-js-browserify-minformat", bus.at("browserslist"), env.release, context.result.babelJs ]);
            if (!env.nocache) {
                let cacheValue = oCache.get(cacheKey);
                if (cacheValue) {
                    return context.result.browserifyJs = Promise.resolve(cacheValue);
                }
            }
            context.result.browserifyJs = new Promise((resolve, reject) => {
                let stime = new Date().getTime();
                csjs.browserify(context.result.babelJs, null).then(js => {
                    js = env.release ? csjs.miniJs(js) : csjs.formatJs(js);
                    oCache.set(cacheKey, js);
                    resolve(js);
                }).catch(e => {
                    File.write(env.path.build + "/error/browserify.log", context.result.babelJs + "\n\n" + e.stack);
                    reject(e);
                });
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const hash = require("@gotoeasy/hash");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const fs = require("fs");
    bus.on("编译插件", function() {
        return postobject.plugin("y85p-write-page", function(root, context) {
            if (!context.result.isPage) {
                return false;
            }
            let env = bus.at("编译环境");
            let browserslist = bus.at("browserslist");
            let stime = new Date().getTime(), time;
            context.result.browserifyJs.then(browserifyJs => {
                let fileHtml = bus.at("页面目标HTML文件名", context.input.file);
                let fileCss = bus.at("页面目标CSS文件名", context.input.file);
                let fileJs = bus.at("页面目标JS文件名", context.input.file);
                let html = context.result.html;
                let css = context.result.pageCss;
                let js = browserifyJs;
                context.result.js = js;
                css ? File.write(fileCss, css) : File.remove(fileCss);
                File.write(fileJs, js);
                File.write(fileHtml, html);
                env.watch && (context.result.hashcode = hash(html + css + js));
                time = new Date().getTime() - stime;
                console.info("[pack]", time + "ms -", fileHtml.substring(env.path.build_dist.length + 1));
            }).catch(e => {
                console.error("[pack]", e);
            });
        });
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const csjs = require("@gotoeasy/csjs");
    const File = require("@gotoeasy/file");
    const postobject = require("@gotoeasy/postobject");
    const Err = require("@gotoeasy/err");
    const hash = require("@gotoeasy/hash");
    const browserslist = require("browserslist");
    bus.on("browserslist", function() {
        return function() {
            let rs = browserslist();
            return hash(rs.join("\n"));
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const hash = require("@gotoeasy/hash");
    bus.on("哈希样式类名", function() {
        return function renameCssClassName(srcFile, clsName) {
            let name = clsName;
            if (name.startsWith("_")) {
                return name;
            }
            const env = bus.at("编译环境");
            if (clsName.indexOf("@") > 0) {
                let ary = clsName.split("@");
                name = `${ary[1]}---${ary[0]}`;
            } else {
                if (name.indexOf("---") > 0 || name.indexOf("___") > 0 || name.startsWith("_")) {} else {
                    let tag = bus.at("标签全名", srcFile);
                    name = `${clsName}___${hash(tag)}`;
                }
            }
            if (!env.release) {
                return name;
            }
            return "_" + hash(name.toLowerCase());
        };
    }());
})();

(() => {
    const File = require("@gotoeasy/file");
    const bus = require("@gotoeasy/bus");
    const npm = require("@gotoeasy/npm");
    const hash = require("@gotoeasy/hash");
    const findNodeModules = require("find-node-modules");
    bus.on("标签全名", function() {
        return file => {
            let idx = file.indexOf(":");
            if (idx > 0 && file.substring(idx).indexOf(".") < 0) {
                return file;
            }
            let tagpkg = "";
            idx = file.lastIndexOf("/node_modules/");
            if (idx > 0) {
                let ary = file.substring(idx + 14).split("/");
                if (ary[0].startsWith("@")) {
                    tagpkg = ary[0] + "/" + ary[1] + ":" + File.name(file);
                } else {
                    tagpkg = ary[0] + ":" + File.name(file);
                }
            } else {
                tagpkg = File.name(file);
            }
            return tagpkg;
        };
    }());
    bus.on("标签源文件", function() {
        return tag => {
            if (tag.endsWith(".rpose")) {
                return tag;
            }
            if (tag.indexOf(":") > 0) {
                let ary = tag.split(":");
                ary[0].indexOf("=") > 0 && (ary = ary[0].split("="));
                let oPkg = bus.at("模块组件信息", ary[0].trim());
                let files = oPkg.files;
                let name = "/" + ary[1] + ".rpose";
                for (let i = 0, srcfile; srcfile = files[i++]; ) {
                    if (srcfile.endsWith(name)) {
                        return srcfile;
                    }
                }
                return bus.at("标签库引用", tag, oPkg.config);
            } else {
                let file = bus.at("标签项目源文件", tag);
                if (file) {
                    return file;
                }
                let env = bus.at("编译环境");
                return bus.at("标签库引用", tag, env.path.root);
            }
        };
    }());
    bus.on("文件所在模块", function() {
        return file => {
            let pkg = "/", idx = file.lastIndexOf("/node_modules/");
            if (idx > 0) {
                let rs = [];
                let ary = file.substring(idx + 14).split("/");
                if (ary[0].startsWith("@")) {
                    pkg = ary[0] + "/" + ary[1];
                } else {
                    pkg = ary[0];
                }
            }
            return pkg;
        };
    }());
    bus.on("文件所在项目根目录", function() {
        return file => {
            let dir, idx = file.lastIndexOf("/node_modules/");
            if (idx > 0) {
                let rs = [];
                rs.push(file.substring(0, idx + 13));
                let ary = file.substring(idx + 14).split("/");
                if (ary[0].startsWith("@")) {
                    rs.push(ary[0]);
                    rs.push(ary[1]);
                } else {
                    rs.push(ary[0]);
                }
                dir = rs.join("/");
            } else {
                let env = bus.at("编译环境");
                dir = env.path.root;
            }
            return dir;
        };
    }());
    bus.on("文件所在项目配置文件", function() {
        return file => {
            let btfFile, idx = file.lastIndexOf("/node_modules/");
            if (idx > 0) {
                let rs = [];
                rs.push(file.substring(0, idx + 13));
                let ary = file.substring(idx + 14).split("/");
                if (ary[0].startsWith("@")) {
                    rs.push(ary[0]);
                    rs.push(ary[1]);
                } else {
                    rs.push(ary[0]);
                }
                rs.push("rpose.config.btf");
                btfFile = rs.join("/");
            } else {
                let env = bus.at("编译环境");
                btfFile = env.path.root + "/rpose.config.btf";
            }
            if (File.existsFile(btfFile)) {
                return btfFile;
            }
        };
    }());
    bus.on("模块组件信息", function(map = new Map()) {
        return function getImportInfo(pkgname) {
            pkgname.indexOf(":") > 0 && (pkgname = pkgname.substring(0, pkgname.indexOf(":")));
            pkgname.lastIndexOf("@") > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf("@")));
            pkgname = pkgname.toLowerCase();
            if (!map.has(pkgname)) {
                let env = bus.at("编译环境");
                let nodemodules = [ ...findNodeModules({
                    cwd: env.path.root,
                    relative: false
                }), ...findNodeModules({
                    cwd: __dirname,
                    relative: false
                }) ];
                for (let i = 0, module, path; module = nodemodules[i++]; ) {
                    path = File.resolve(module, pkgname).replace(/\\/g, "/");
                    if (File.existsDir(path)) {
                        let obj = JSON.parse(File.read(File.resolve(path, "package.json")));
                        let version = obj.version;
                        let name = obj.name;
                        let pkg = name + "@" + version;
                        let files = File.files(path, "/src/**.rpose");
                        let config = File.resolve(path, "rpose.config.btf");
                        map.set(name, {
                            path: path,
                            pkg: pkg,
                            name: name,
                            version: version,
                            files: files,
                            config: config
                        });
                        break;
                    }
                }
            }
            return map.get(pkgname) || {
                files: [],
                config: ""
            };
        };
    }());
    bus.on("组件类名", function() {
        return file => {
            let tagpkg = bus.at("标签全名", bus.at("标签源文件", file));
            tagpkg = tagpkg.replace(/[@\/`]/g, "$").replace(/\./g, "_").replace(":", "$-");
            tagpkg = ("-" + tagpkg).split("-").map(s => s.substring(0, 1).toUpperCase() + s.substring(1)).join("");
            return tagpkg;
        };
    }());
    bus.on("组件目标文件名", function() {
        return function(srcFile) {
            let env = bus.at("编译环境");
            if (srcFile.startsWith(env.path.src_buildin)) {
                return "$buildin/" + File.name(srcFile);
            }
            let tagpkg = bus.at("标签全名", srcFile);
            return tagpkg.replace(":", "/");
        };
    }());
    bus.on("页面目标JS文件名", function() {
        return function(srcFile) {
            let env = bus.at("编译环境");
            return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".js";
        };
    }());
    bus.on("页面目标CSS文件名", function() {
        return function(srcFile) {
            let env = bus.at("编译环境");
            return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".css";
        };
    }());
    bus.on("页面目标HTML文件名", function() {
        return function(srcFile) {
            let env = bus.at("编译环境");
            return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length - 6) + ".html";
        };
    }());
    bus.on("自动安装", function(rs = {}) {
        return function autoinstall(pkg) {
            pkg.indexOf(":") > 0 && (pkg = pkg.substring(0, pkg.indexOf(":")));
            pkg.lastIndexOf("@") > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf("@")));
            if (!rs[pkg]) {
                if (!npm.isInstalled(pkg)) {
                    rs[pkg] = npm.install(pkg, {
                        timeout: 6e4
                    });
                } else {
                    rs[pkg] = true;
                }
            }
            return rs[pkg];
        };
    }());
    bus.on("页面图片相对路径", function() {
        return srcFile => {
            let env = bus.at("编译环境");
            let ary = srcFile.substring(env.path.src.length).split("/");
            let rs = "../".repeat(ary.length - 2) + env.path.build_dist_images;
            return (rs || ".") + "/";
        };
    }());
})();

(() => {
    const bus = require("@gotoeasy/bus");
    const postobject = require("@gotoeasy/postobject");
    bus.on("编译插件", function() {
        return postobject.plugin("z99p-log", function(root, result) {});
    }());
})();

console.timeEnd("load");

const bus = require("@gotoeasy/bus");

const npm = require("@gotoeasy/npm");

const Err = require("@gotoeasy/err");

const File = require("@gotoeasy/file");

const postobject = require("@gotoeasy/postobject");

async function build(opts) {
    console.time("build");
    try {
        let env = bus.at("编译环境", opts);
        bus.at("clean");
        await Promise.all(bus.at("全部编译"));
    } catch (e) {
        console.error(Err.cat("build failed", e).toString());
    }
    console.timeEnd("build");
}

function clean(opts) {
    console.time("clean");
    try {
        let env = bus.at("编译环境", opts);
        bus.at("clean");
    } catch (e) {
        console.error(Err.cat("clean failed", e).toString());
    }
    console.timeEnd("clean");
}

async function watch(opts) {
    await build(opts);
    bus.at("文件监视");
}

module.exports = {
    build: build,
    clean: clean,
    watch: watch
};