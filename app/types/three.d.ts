// three@0.128（r128）npm 包不携带类型定义。3D 引擎文件（app/three/*.ts）均 @ts-nocheck，
// 唯一引用点是 PlanetCanvas 的动态 import 并挂到 window.THREE，粗粒度 any 声明即可，
// 避免引入与 r128 不同步的 @types/three 造成大量假错误。
// three@0.128 (r128) ships no types. Engine files under app/three are all @ts-nocheck; the only
// typed reference is PlanetCanvas' dynamic import, so a coarse `any` shim suffices -- pulling in
// @types/three (out of sync with r128) would create a flood of false errors.
declare module 'three' {
  const THREE: any;
  export = THREE;
}
