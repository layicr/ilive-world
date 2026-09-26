import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../app/three/concert';

// 3D 引擎配置不变量（抽取自 concert.js 的 CONFIG，画面依赖这些数量/调色板）
// Invariants of the 3D engine config (from concert.js CONFIG; visuals rely on these counts/palettes)
describe('concert CONFIG 不变量', () => {
  it('舞台数量 = 30', () => {
    expect(CONFIG.stage.count).toBe(30);
  });

  it('调色板长度符合舞台配色取模逻辑', () => {
    expect(CONFIG.stageColors).toHaveLength(6);
    expect(CONFIG.noteColors).toHaveLength(4);
    expect(CONFIG.hairColors).toHaveLength(3);
  });

  it('台前观众站位：固定 2 人 + 精灵位 + 2 只宠物位', () => {
    expect(CONFIG.fanSpacing.persons).toHaveLength(2);
    expect(CONFIG.fanSpacing.pets).toHaveLength(2);
    expect(CONFIG.fanSpacing.elf).toHaveLength(2);
  });

  it('花车两条航线（ring + globe），globe 带领头车', () => {
    const routes = CONFIG.floats.map(f => f.route);
    expect(routes).toEqual(expect.arrayContaining(['ring', 'globe']));
    const globe = CONFIG.floats.find(f => f.route === 'globe');
    expect(globe?.leader?.count).toBeGreaterThanOrEqual(1);
  });

  it('摆放禁带参数为正数', () => {
    expect(CONFIG.stage.minSpacing).toBeGreaterThan(0);
    expect(CONFIG.stage.avoidProps).toBeGreaterThan(0);
    expect(CONFIG.stage.ringMargin).toBeGreaterThan(0);
    expect(CONFIG.stage.backBand).toBeGreaterThan(0);
  });
});
