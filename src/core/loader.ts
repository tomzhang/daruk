import assert = require('assert');
import fs = require('fs');
import is = require('is');
import path = require('path');
import { normalize } from 'upath';
import { Daruk } from '../typings/daruk';
import { getFilePathRecursive, isJsTsFile, isSubClass, JsTsReg, uRequire } from '../utils';
import BaseContext from './base_context';

const join = path.join;
const isFn = is.fn;
const isObj = is.object;

class Loader {
  /**
   * @desc 加载 controller
   * controller 的目录结构也是路由 path 的一部分
   */
  public loadController(path: string) {
    // 以路由的 path 作为 key 保存 controller
    const routePath2ControllerMap: any = {};
    let routers = getFilePathRecursive(path);
    routers
      .map((router: string) => normalize(router))
      .forEach((file: string) => {
        let controller = uRequire(file);
        assert(
          isSubClass(controller, BaseContext),
          `[controller must export a subclass of Daruk.BaseController in path: ${file}`
        );
        let RoutePath = file.replace(normalize(path), '').replace(JsTsReg, '');
        // 验证类名必须是首字母大写的驼峰形式，并且和路由 path 匹配
        const validClassName = RoutePath
          // 斜线后面的字母大写, RoutePath 定会有 / 开头
          .replace(/\/([a-z])/g, (matches: string, capture: string) => {
            return capture.toLocaleUpperCase();
          })
          // 去除所有斜线
          .replace(/\//g, '');
        assert(
          validClassName === controller.name,
          `controller class name should be '${validClassName}' ( CamelCase style and match route path ) in path: ${file}`
        );

        // 认为 index 文件名对应的路由是 /
        RoutePath = RoutePath.replace(/\/index$/g, '/');
        routePath2ControllerMap[RoutePath] = controller;
      });
    return routePath2ControllerMap;
  }
  public loadModule(type: string, path: string) {
    const descriptions = this.getModuleDesc(path);
    const modules: any = {};
    descriptions.forEach((desc) => {
      const { name, path } = desc;
      const mod = uRequire(path);
      assert(isFn(mod), `[${type}] must export a function in path in path: ${path}`);
      modules[name] = mod;
    });
    return modules;
  }
  /**
   * @desc 加载导出类型为 class 的模块
   * 比如 src/services
   */
  public loadClassModule(key: string, path: string) {
    const descriptions = this.getModuleDesc(path);
    const modules: any = {};
    descriptions.forEach((desc) => {
      const { name, path } = desc;
      const classModule = uRequire(path);
      assert(isFn(classModule), `[${key}] must export a function, ${path}`);
      assert(
        isSubClass(classModule, BaseContext),
        `[${key}] must export a subclass of Daruk.Base${key.charAt(0).toUpperCase() +
          key.slice(1)} in path: ${path}`
      );
      modules[name] = classModule;
    });
    return modules;
  }
  /**
   * @desc 获取约定目下第一级目录的文件名和 path
   */
  private getModuleDesc(modulePath: string) {
    const descriptions: Array<{ name: string; path: string }> = [];
    if (fs.existsSync(modulePath)) {
      const files = fs.readdirSync(modulePath);
      files.forEach((val: string) => {
        const fullPath = join(modulePath, val);
        const isFile = fs.lstatSync(fullPath).isFile();
        // 只加载 js 文件和 文件夹（文件夹内需要有 index.js）
        if ((isFile && isJsTsFile(fullPath)) || !isFile) {
          descriptions.push({
            name: isFile ? val.replace(JsTsReg, '') : val,
            path: fullPath
          });
        }
      });
    }
    return descriptions;
  }
}

export default new Loader();