// @ts-nocheck
/* =====================================================================
 * cardCss.ts —— 信息卡/弹窗/轮播的样式文本（由 index.ts 注入 <head>）
 * 颜色/尺寸读 CONFIG.card，保持「样式随引擎自包含」的移植约定。
 * cardCss.ts — stylesheet text for the info-card / modal / marquee (injected into <head> by index.ts).
 * Colors & sizes read CONFIG.card, keeping the "engine ships with its own CSS" porting convention.
 * ===================================================================== */
export function cardCss(C) {
  return '.concert-card{position:fixed;z-index:20;width:' + (C.card.width - 6) + 'px;'
    + 'background:linear-gradient(180deg,' + C.card.bgTop + ' 0%,' + C.card.bgMid + ' 60%,' + C.card.bgBottom + ' 100%);'
    + 'border:3px solid ' + C.card.accent + ';border-radius:14px;box-shadow:0 10px 26px rgba(50,32,8,.4),inset 0 2px 3px rgba(255,255,255,.6);'
    + 'padding:10px 13px 11px;user-select:none;cursor:default;font-family:"Segoe UI","Microsoft YaHei",sans-serif;display:none}'
    + '.concert-card.show{display:block;animation:ccPop .18s ease-out}@keyframes ccPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'
    + '.cc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.cc-title{font-size:15px;font-weight:800;color:#5e4a2e}'
    + '.cc-close{cursor:pointer;font-size:16px;font-weight:700;color:#8a744d;line-height:1;padding:2px 5px}.cc-close:hover{color:#4d3d24}'
    + '.cc-star{font-size:12.5px;color:#6e5836;margin-bottom:7px;padding-bottom:7px;border-bottom:1.5px dashed #c4a878}'
    + '.cc-star:empty{display:none;margin:0;padding:0;border:0}'
    + '.cc-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#7d6644;margin:3.5px 0}.cc-row span{flex:0 0 auto}.cc-row b{color:#4d3d24;font-weight:700;text-align:right}'
    + '.cc-tags{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:72%}'
    + '.cc-tag{display:inline-block;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,.6);border:1px solid #c4a878;color:#5e4a2e;font-size:11px;font-weight:700;line-height:1.6;white-space:nowrap}'
    + '.cc-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}'
    + '.cc-like{display:none;padding:5px 14px;border:1.5px solid ' + C.card.accent + ';border-radius:16px;background:rgba(255,255,255,.55);color:#5e4a2e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'
    + '.cc-like.on{display:inline-block}.cc-like:hover{background:rgba(255,255,255,.85)}'
    + '.cc-btn{display:none;padding:5px 12px;border:1.5px solid ' + C.card.accent + ';border-radius:16px;background:rgba(255,255,255,.55);color:#5e4a2e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'
    + '.cc-btn.on{display:inline-block}.cc-btn:hover{background:rgba(255,255,255,.85)}'
    + '.cc-modal{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(20,14,6,.55);padding:20px;font-family:"Segoe UI","Microsoft YaHei",sans-serif}'
    + '.cc-modal.show{display:flex}'
    + '.cc-modal-box{position:relative;width:100%;max-width:520px;max-height:80vh;overflow:auto;background:linear-gradient(180deg,' + C.card.bgTop + ' 0%,' + C.card.bgBottom + ' 100%);border:3px solid ' + C.card.accent + ';border-radius:14px;box-shadow:0 14px 34px rgba(0,0,0,.45);padding:16px 18px 18px}'
    + '.cc-modal-close{position:absolute;top:6px;right:12px;cursor:pointer;font-size:22px;font-weight:700;color:#8a744d;line-height:1}.cc-modal-close:hover{color:#4d3d24}'
    + '.cc-modal-max{position:absolute;top:8px;right:40px;cursor:pointer;font-size:17px;font-weight:700;color:#8a744d;line-height:1;padding:2px 6px;border-radius:6px}.cc-modal-max:hover{color:#4d3d24;background:rgba(255,255,255,.5)}'
    + '.cc-modal-box.maximized{max-width:none;width:min(96vw,calc((90vh - 70px) * 16 / 9));max-height:90vh}'
    + '.cc-modal-title{font-size:15px;font-weight:800;color:#5e4a2e;margin:0 58px 12px 0}'
    + '.cc-sl-search{width:100%;box-sizing:border-box;padding:8px 12px;margin:0 0 12px;border:1.5px solid ' + C.card.accent + ';border-radius:10px;background:rgba(255,255,255,.72);font-size:13px;color:#5e4a2e;font-family:inherit;outline:none}'
    + '.cc-sl-search:focus{border-color:#8a6d3b;background:#fff;box-shadow:0 0 0 3px rgba(180,147,92,.18)}'
    + '.cc-sl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}'
    + '.cc-sl-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.5);border:1px solid rgba(180,147,92,.35);transition:background .15s ease,box-shadow .15s ease}'
    + '.cc-sl-item:hover{background:rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(94,74,46,.16)}'
    + '.cc-sl-idx{flex:none;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:' + C.card.accent + ';color:#fff;font-size:12px;font-weight:800;padding:0 5px}'
    + '.cc-sl-name{flex:1;font-size:13px;color:#5e4a2e;font-weight:600;word-break:break-word}'
    + '.cc-sl-play{flex:none;display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border:1.5px solid ' + C.card.accent + ';border-radius:14px;background:rgba(255,255,255,.75);color:#5e4a2e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}'
    + '.cc-sl-play:hover{background:' + C.card.accent + ';color:#fff}'
    + '.cc-sl-empty{text-align:center;color:#8a744d;font-size:13px;padding:18px 0}'
    + '.cc-video-frame{position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:10px;overflow:hidden}.cc-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}'
    + '.cc-arrow{position:absolute;width:14px;height:14px;background:' + C.card.bgMid + ';border-right:3px solid ' + C.card.accent + ';border-bottom:3px solid ' + C.card.accent + ';transform:rotate(45deg)}'
    + '.stage-marquee{position:fixed;left:0;top:0;z-index:18;pointer-events:none;display:none;min-width:120px;max-width:220px;padding:7px 11px;border-radius:12px;background:linear-gradient(180deg,rgba(30,40,70,.92),rgba(20,28,52,.92));border:1.5px solid rgba(255,215,140,.55);box-shadow:0 8px 22px rgba(0,0,0,.4);color:#ffe9c7;font-family:"Segoe UI","Microsoft YaHei",sans-serif;font-size:12px;line-height:1.5;will-change:transform,opacity}'
    + '.stage-marquee .sm-time{color:#ffd98a}.stage-marquee .sm-artist{font-weight:800;font-size:13px;color:#fff}.stage-marquee .sm-theme{color:#bfe0ff}';
}
