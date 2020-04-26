const bus = require('@gotoeasy/bus');
const npm = require('@gotoeasy/npm');

bus.on('自动安装', function(rs={}){
    
    return function autoinstall(pkg){

        if (pkg === '~') return true;                                                   // 所在工程中的组件，不必安装

        pkg.indexOf(':') > 0 && (pkg = pkg.substring(0, pkg.indexOf(':')));             // @scope/pkg:component => @scope/pkg
        pkg.lastIndexOf('@') > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf('@')));     // 不该考虑版本，保险起见修理一下，@scope/pkg@x.y.z => @scope/pkg

        let env = bus.at('编译环境');
        if ( env.packageName === pkg ) return true;                                     // 包名和当前项目的包名一样，不安装，返回true假装正常结束

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
