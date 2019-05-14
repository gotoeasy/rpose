const bus = require('@gotoeasy/bus');
const npm = require('@gotoeasy/npm');

bus.on('自动安装', function(rs={}){
    
    return function autoinstall(pkg){

        pkg.indexOf(':') > 0 && (pkg = pkg.substring(0, pkg.indexOf(':')));             // @scope/pkg:component => @scope/pkg
        pkg.lastIndexOf('@') > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf('@')));     // 不该考虑版本，保险起见修理一下，@scope/pkg@x.y.z => @scope/pkg

        if ( !rs[pkg] ) {
            if ( !npm.isInstalled(pkg) ) {
                rs[pkg] = npm.install(pkg, {timeout: 60000});                           // 安装超时1分钟则异常
            }else{
                rs[pkg] = true;
            }
        }
        return rs[pkg];
    }

}());
