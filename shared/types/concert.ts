// 客户端 / 服务端共用的演唱会 DTO（Nuxt 4 `#shared` 别名，app 与 server 均可导入）。
// /api/concerts（列表）与 /api/concerts/:id（详情）两个端点返回同一形状，前端只需一份类型。
// Shared concert DTO for both app and server (Nuxt 4 `#shared` alias).
// The list and detail endpoints return the same shape, so the frontend needs only one type.

/** 歌单单曲（信息卡弹窗播放按钮用；link 可为空串）· A setlist song (link may be empty; powers the modal play button) */
export interface ConcertSong {
  name: string;
  link: string;
}

/**
 * 演唱会卡片数据 · Concert card DTO
 * @description 除 id/seq/date/time/likes 外均为按当前 locale 解析后的纯文本。
 *              Everything except id/seq/date/time/likes is plain text already resolved to the request locale.
 */
export interface ConcertCard {
  id: number;              // 主键 · primary key
  seq: number;             // 展示序号（seed 稳定排序键）· display order (stable seed sort key)
  name: string;            // 演唱会名称 · concert name
  artist: string;          // 艺人 · artist
  theme: string;           // 主题 · theme
  country: string;         // 国家 · country
  province: string;        // 省份 · province
  city: string;            // 城市 · city
  venue: string;           // 场馆 · venue
  seat: string;            // 座位 · seat
  price: string;           // 票价（已格式化文本）· price (formatted text)
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  description: string;     // 描述 · description
  video: string;           // 视频文案 / BV 号 · video caption or bvid
  videoUrl: string;        // 视频链接 / BV 号 · video URL or bvid
  songs: ConcertSong[];    // 歌单 · setlist
  tags: string[];          // 标签 · tags
  likes: number;           // 点赞总数（基线热度 + 真实点赞）· total likes (seed baseline + real likes)
  liked: boolean;          // 当前访客是否已点赞 · whether the current visitor liked it
}
