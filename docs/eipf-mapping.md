# 与 EIPF 的映射

[EIPF](https://github.com/muzirin/EIPF)（Electric Interactive Publications Format，CC0 1.0）是一套
基于 ZIP 的交互式数字出版物开放格式：`Series (.eipfs)` → `Album (.eipfa)` → `Entry (.eipf)` 三层容器，
每个 Entry 的 `resource/text/body.xhtml` 以**线性的 `scene-entry` 序列**承载内容。

StudyInGal 的 Galgame 剧本与随堂题目按下面的方式映射到 EIPF，便于后续导出 `.eipf` 包。

> 映射实现：`src/main/lib/eipf.ts`（含单元测试 `eipf.test.ts`）。

## 条目映射

| StudyInGal | EIPF `data-type` | 说明 |
|---|---|---|
| `DialogueLine.speaker = 'character' \| 'user'` | `dialog` | `data-speaker` 为说话者（用户侧写「我」） |
| `DialogueLine.speaker = 'narration'` | `dialog` | `data-thought="true"`，无说话者 |
| `QuizQuestion`（单选） | `decision` | 选项即 `data-choice-index` 顺序；正确项与解析放入 `data-params` |
| `QuizQuestion.branches[]`（答题分支） | `predicate` + `dialog` + `navigate` | 每个选项一条 `predicate(data-references=选项下标)` → 该分支的角色台词 → `navigate` 回主线 |

### 对话

```html
<div class="scene-entry scene-dialogue" data-type="dialog" data-index="0" data-cmd="Dialog"
     data-speaker="小樱" data-params="{&quot;emotion&quot;:&quot;happy&quot;}">
  <span class="speaker">小樱</span>
  <span class="text">今天我们从屏幕反光说起吧。</span>
</div>
```

- 情绪（`emotion`）EIPF 规范里没有专门字段，按规范约定放进 `data-params`。

### 题目（单选题）

```html
<div class="scene-entry scene-decision" data-type="decision" data-index="12" data-cmd="Quiz"
     data-text="梯度本身指向哪个方向？"
     data-params="{&quot;answerIndex&quot;:0,&quot;explanation&quot;:&quot;梯度是最陡上坡方向。&quot;,&quot;options&quot;:[&quot;最陡上坡方向&quot;,&quot;最陡下坡方向&quot;,&quot;随机方向&quot;,&quot;参数最多的方向&quot;]}">
  <button class="choice-btn" data-choice-index="0">最陡上坡方向</button>
  <button class="choice-btn" data-choice-index="1">最陡下坡方向</button>
  <button class="choice-btn" data-choice-index="2">随机方向</button>
  <button class="choice-btn" data-choice-index="3">参数最多的方向</button>
</div>
```

- EIPF 的 `decision` 只描述**分支**（不描述对错），所以「正确项 + 解析」按规范「新实现类型的参数以 `data-params` 完整保留」的约定放进 `data-params`。
- 选项顺序即 `data-choice-index` 顺序，与渲染器 `choice-btn` 一一对应。

### 答题分支（选对了强化 / 选错了由角色解释）

EIPF 规范里 `decision` 的按钮**不写** `data-target`（「分支跳转由渲染器自定义实现（配合 `predicate`）」），
因此每个选项对应一组条目：`predicate`（引用选项下标）→ 该分支的角色台词 → `navigate` 回到主线。

```html
<!-- decision（data-index="12"）… -->
<div class="scene-entry scene-predicate" data-type="predicate" data-index="13" data-cmd="Predicate"
     data-references="0" data-params="{&quot;references&quot;:0,&quot;correct&quot;:true}"></div>
<div class="scene-entry scene-dialogue" data-type="dialog" data-index="14" data-cmd="Dialog"
     data-speaker="小樱" data-params="{&quot;emotion&quot;:&quot;happy&quot;,&quot;choiceIndex&quot;:0,&quot;correct&quot;:true,&quot;branch&quot;:true}">
  <span class="speaker">小樱</span>
  <span class="text">对，梯度指的就是最陡上坡方向。</span>
</div>
<div class="scene-entry scene-navigate" data-type="navigate" data-index="15" data-cmd="GotoPage"
     data-target="18" data-params="{&quot;to&quot;:18}"></div>
```

- 选对的分支台词是**强化**（肯定 + 点出关键），选错的是**纠正/解释**（先指出误解，再给正确要点）。
- `data-params.correct` 由 `answerIndex` 推导，便于导出/校验；`data-references` 与 `data-choice-index` 对齐。
- 跳转目标（`data-params.to` / `data-target`）是**主线恢复点**：该题所有分支条目之后的那个 `data-index`。

## 内部字段对照

| StudyInGal | EIPF |
|---|---|
| `QuizQuestion.index` | `data-index`（线性序号，从 0 递增） |
| `QuizQuestion.question` | `data-text` / 题面文本 |
| `QuizQuestion.options` | `data-choice-index` 按钮序列 |
| `QuizQuestion.answerIndex` + `explanation` | `data-params.answerIndex` / `.explanation` |
| `QuizQuestion.checkpoint` | 题目条目插入到「该行台词之后」的位置 |
| `QuizQuestion.branches[].choiceIndex` | `predicate.data-references`（= `data-choice-index`） |
| `QuizQuestion.branches[].text` | 分支 `dialog` 的正文（`speaker` = 角色名） |
| `GalScript.lines` + `questions` | `body.xhtml` 中的线性 `scene-entry` 序列 |

`scriptToEntries()` 现在按 `checkpoint` 把题目（连同它的分支条目）**穿插**到对应台词之后，
`index` 保持连续；没有 `checkpoint` 的旧题目接在末尾。

## 现状与后续

- ✅ 已实现：剧本 / 题目的 EIPF 结构映射与 `body.xhtml` 片段生成（纯函数 + 单测）。
- ⏳ 待实现：打包成 `.eipf`（ZIP：`index.json` + `main.xml` + `resource/text/body.xhtml` + 资源目录），
  以及按 EIPF 的 `reader-integration` 三级查找导出背景 / 立绘资源。
  需要时可在「创意工坊」里增加「导出为 EIPF」入口。

EIPF 本体以 **CC0 1.0** 发布，因此本映射说明与实现同样可自由使用。
