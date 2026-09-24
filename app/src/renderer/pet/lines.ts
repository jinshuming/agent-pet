// Speech-bubble lines: the idol's voice for each state and reaction.
import type { AgentState, Reaction } from './clips';

export const STATE_LINES: Partial<Record<AgentState, string[]>> = {
  greet: ['嗨～我来啦！', '今天也一起加油！', '想我了没？'],
  thinking: ['让我想想…', '嗯…这个怎么写好呢', '灵感快来！'],
  permission: ['这个要你点头哦～', '可以吗？可以吗？', '批准一下嘛 🙏'],
  done: ['呼…终于好了…', '累死了，快夸我！', '搞定！喘口气…'],
  error: ['啊啊啊出错了…', '没事没事，再来一次！', '我不信我搞不定！'],
  sleep: ['Zzz…', '困了…'],
};

export const REACTION_LINES: Record<Reaction, string[]> = {
  busyPoke: ['等一下嘛！', '还没好啦，再等等～', '嘘——我快写完了', '别闹，写代码呢！'],
  headPat: ['嘿嘿…', '再摸一下？'],
  poke: ['喂！', '干嘛呀～'],
  doubleClick: ['来拍一张！'],
  petted: ['好啦好啦 ❤️'],
  drop: ['哎哟！'],
  dizzy: ['@_@ 头…头好晕…', '世界在转…', '别、别转了…'],
};

/** While he's being spun (before he gets dizzy). */
export const SPIN_LINES = ['哇啊啊——', '慢点慢点！', '转转转～'];

/** Flung through the air, or falling after letting go of the top edge (keyed by why he's flying). */
export const FLY_LINES: Record<'fling' | 'tired' | 'poked' | 'critical' | 'hop', string[]> = {
  fling: ['哇啊啊啊——', '我会飞啦！', '救命——'],
  tired: ['手酸了…', '撑不住了——', '啊——！'],
  poked: ['别戳！啊——', '手滑了！'],
  critical: ['等等，有事找你！'],
  hop: ['嘿咻～'],
};
/** Resting after being left alone: walking to a wall, sitting, nodding off, woken up. */
export const REST_LINES = {
  walk: ['走走～找个地方歇会儿', '去墙边坐坐'],
  sit: ['坐一会儿～', '你忙你的，我陪着你', '（靠墙坐下）'],
  doze: ['好困…', '眼皮在打架…'],
  asleep: ['Zzz…', '呼…呼…'],
  wake: ['嗯？我没睡！', '来啦来啦～', '被你发现了…'],
};
/** Leaning on a side of the screen, being cool. */
export const LEAN_LINES = ['这面墙归我了', '酷吧？', '（靠墙）', '别打扰我耍帅', '今天也很帅呢'];
/** Hanging from the top of the screen. */
export const HANG_LINES = ['抓住了！', '好高…别往下看…', '我…我坚持得住！'];

export function pick(lines: string[] | undefined): string {
  if (!lines?.length) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}
