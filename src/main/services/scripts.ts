import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { SCRIPTS_FILE } from '@shared/constants'
import type { DialogueLine, DialogueSpeaker, GalScript } from '@shared/types'

const store = new JsonStore<GalScript[]>(join(dataDir(), SCRIPTS_FILE), [])

export const EXAMPLE_SOURCE_ID = '__example__'
const EXAMPLE_CHARACTER_ID = 'char_sakura'

export function listScripts(): GalScript[] {
  return store.read().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getScript(id: string): GalScript | null {
  return store.read().find((item) => item.id === id) ?? null
}

export function saveScript(input: Partial<GalScript> & { id?: string }): GalScript {
  const list = store.read()
  const now = Date.now()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: GalScript = { ...list[index], ...input, id: list[index].id, updatedAt: now }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: GalScript = {
    id: input.id ?? newId('script'),
    sourceId: input.sourceId ?? '',
    sourceKind: input.sourceKind ?? 'paper',
    title: input.title ?? '未命名剧本',
    characterId: input.characterId ?? '',
    lines: input.lines ?? [],
    providerId: input.providerId ?? null,
    model: input.model ?? null,
    createdAt: now,
    updatedAt: now
  }
  store.write([...list, created])
  return created
}

export function deleteScript(id: string): void {
  store.write(store.read().filter((item) => item.id !== id))
}

/* ------------------------------- 示例剧本 ------------------------------- */

function line(speaker: DialogueSpeaker, text: string, emotion = 'neutral'): DialogueLine {
  return { id: newId('line'), speaker, text, emotion }
}

interface ExampleSeed {
  slug: string
  title: string
  sourceKind: 'paper' | 'textbook'
  model: string
  lines: DialogueLine[]
}

function buildExamples(): ExampleSeed[] {
  return [
    {
      slug: 'gradient-descent',
      title: '示例 · 梯度下降到底在做什么',
      sourceKind: 'paper',
      model: '内置示例（无需 API）',
      lines: [
        line('character', '同学，今天我们不讲公式，先讲一个下山的故事。', 'happy'),
        line('user', '下山？跟梯度下降有什么关系？'),
        line('character', '想象你被蒙住眼睛放在山坡上，只能靠脚底感觉哪边更陡。', 'thinking'),
        line('narration', '（她拿起粉笔，在黑板上画出一条起伏的曲线）'),
        line('character', '梯度就是「最陡的上坡方向」。要下山，就朝它的反方向走一小步。', 'neutral'),
        line('character', '用数学写出来就是：θ ← θ − η ∇J(θ)。', 'serious'),
        line('user', '那个 η 是什么？'),
        line('character', '学习率。步子太小会走很久，太大会直接跨过山谷甚至滚下山。', 'thinking'),
        line('narration', '（她在曲线上画了三组不同大小的箭头）'),
        line('character', '喏，左边这组是 η 太小，中间刚好，右边直接飞出去了。', 'surprised'),
        line('user', '那为什么深度模型能收敛？损失函数不是很复杂吗？'),
        line('character', '因为高维空间里几乎不存在真正的「鞍点陷阱」，而且随机梯度带来了噪声，反而帮你跳出糟糕的局部解。', 'serious'),
        line('narration', '（窗外天色渐暗，粉笔灰在夕阳里浮动）'),
        line('character', '所以记住三件事：方向看梯度，步长看学习率，噪声不一定是坏事。', 'happy'),
        line('user', '那动量、Adam 又是什么？'),
        line('character', '那是「带上惯性下山」和「给每个方向配不同步长」，下次再讲。今天先到这里～', 'excited')
      ]
    },
    {
      slug: 'fourier',
      title: '示例 · 傅里叶变换的直觉',
      sourceKind: 'paper',
      model: '内置示例（无需 API）',
      lines: [
        line('character', '你有没有想过，一段音乐其实可以拆成很多个纯音？', 'thinking'),
        line('user', '拆开？声音不是连在一起的吗？'),
        line('character', '傅里叶说：任何信号都能写成不同频率正弦波的叠加。', 'neutral'),
        line('narration', '（她在纸上画出一个方波，又叠了几条正弦曲线）'),
        line('character', '看，方波就是这些正弦波按 1、1/3、1/5…… 的幅度叠出来的。', 'happy'),
        line('user', '那傅里叶变换是在做什么？'),
        line('character', '它回答一个问题：这段信号里，各个频率各占多少。', 'serious'),
        line('character', '时域看的是「什么时候」，频域看的是「由什么组成」。', 'thinking'),
        line('narration', '（她转了下笔，在坐标系上点出一串峰值）'),
        line('character', '这些峰就是主要成分。噪声通常摊得很平，信号则集中在少数峰上。', 'neutral'),
        line('user', '所以降噪就是把平的那些按掉？'),
        line('character', '对，理想低通、带通滤波，本质都是在频域里做加减法。', 'excited'),
        line('character', '不过要注意：时域和频域不能同时无限精确，这就是测不准原理在信号里的版本。', 'serious'),
        line('narration', '（夜色爬上窗台，灯下的公式安静地亮着）'),
        line('character', '先记住一句话：变换只是换一双眼睛看同一件事。', 'happy')
      ]
    },
    {
      slug: 'cellular-respiration',
      title: '示例 · 细胞呼吸的三个阶段',
      sourceKind: 'textbook',
      model: '内置示例（无需 API）',
      lines: [
        line('character', '我们今天的主角是葡萄糖，它要被拆开换能量。', 'happy'),
        line('user', '就是呼吸作用吧？'),
        line('character', '对，一共三幕：糖酵解、柠檬酸循环、氧化磷酸化。', 'neutral'),
        line('narration', '（她把黑板分成三栏，依次写上标题）'),
        line('character', '第一幕在细胞质里：1 分子葡萄糖变成 2 分子丙酮酸，净赚 2 个 ATP。', 'neutral'),
        line('user', '听起来产量不高。'),
        line('character', '确实，重头戏在后面。丙酮酸进线粒体，进入第二幕。', 'thinking'),
        line('character', '柠檬酸循环每圈产出 NADH、FADH₂，还有一点 ATP。真正值钱的是那些电子载体。', 'serious'),
        line('narration', '（她在「NADH」旁边画了两枚小电池）'),
        line('user', '所以第三幕是把这些电池用掉？'),
        line('character', '精辟。电子传递链把它们送进氧化磷酸化，最后交给氧气，换来大量 ATP。', 'excited'),
        line('character', '整个流程大约能收获 30～32 个 ATP，其中绝大部分来自第三幕。', 'neutral'),
        line('user', '那如果缺氧呢？'),
        line('character', '就只能靠糖酵解，并走发酵路线，产量一下子掉到 2 个 ATP —— 这就是剧烈运动时会酸胀的原因。', 'serious'),
        line('narration', '（下课铃响，她合上讲义）'),
        line('character', '复习口诀：拆糖 → 转圈 → 用氧。今天的三幕记住了吗？', 'happy')
      ]
    }
  ]
}

/**
 * 写入内置示例剧本。
 * - force=false 时只补充「尚未存在」的示例（按 slug 判断），不会重复添加；
 * - 用户删除后仍可用 force=true 重新加回来。
 */
export function seedExampleScripts(force = false): { added: number; total: number } {
  const list = store.read()
  const existingTitles = new Set(list.map((script) => script.title))
  const now = Date.now()
  const added: GalScript[] = []

  for (const example of buildExamples()) {
    if (!force && existingTitles.has(example.title)) continue
    added.push({
      id: newId('script'),
      sourceId: EXAMPLE_SOURCE_ID,
      sourceKind: example.sourceKind,
      title: example.title,
      characterId: EXAMPLE_CHARACTER_ID,
      lines: example.lines,
      providerId: null,
      model: example.model,
      createdAt: now,
      updatedAt: now
    })
  }

  if (added.length > 0) store.write([...added, ...list])
  return { added: added.length, total: store.read().length }
}

export function hasExampleScripts(): boolean {
  return store.read().some((script) => script.sourceId === EXAMPLE_SOURCE_ID)
}
