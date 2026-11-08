### 需求定义
- ​/product-brainstorming 我想做一个 PC Web 版本的校园外卖平台的课程设计，不考虑商家端只做用户端。我打算分两步走，先做基础功能，再做高级功能。帮我分析一下基础功能包括哪些
- /write-spec
- 【新会话，换模型】检查需求文档的意图表达是否明确，是否写明要做什么不做什么，验收标准是否写成能判定的句子

### 原型设计
- npx skills add nutlope/hallmark --agent codebuddy
- git clone https://github.com/humbleteam/ascii-wireframes .codebuddy/skills/ascii-wireframes
- /ascii-wireframes 根据 SPEC.md​ 生成几个主要页面的原型图，不清楚先跟我确认（K3.1）
- 将决策保存为独立 md 文件
- PROTOTYPE_DECISIONS.md  比较是否符合SPEC.md ，不符合的让我决策
- /hallmark @PROTOTYPE_DECISIONS.md 不用生成代码，先确认视觉主题，提供参考图
- 使用 XXX 主题，并写入 PROTOTYPE_DECISIONS.md
- 根据原型生成 PC Web 网站; DOSE 主题见：https://www.usehallmark.com/themes/dose/#top。不确定的先跟我确认

### 技术方案设计
- /architecture SPEC.md​ 设计系统的架构文档，使用 React+Express+sqlite技术栈，typescript 语言。不确定的先跟我确认
- 是否有使用到 @command:system-design 这个技能
- @command:architecture review ARCHITECTURE.md , 找出设计模糊和考虑不周的优化点
- @command:archify ARCHITECTURE.md 画架构图

### 阶段任务拆分
- plan 模式：ARCHITECTURE.mdSPEC.md 先制定详细的实施计划，不要着急写代码，不确定的先跟我确认。

### 编码实现
- ARCHITECTURE.md  根据技术架构为项目制定核心的代码规范，写入CODEBUDDY.md
- CODEBUDDY.md  为项目添加 eslint 和 tsc 校验

### 代码Review
- /code-review​ 全面 review 项目的前后端代码

### 端到端测试
- /testing-strategy​ 分析项目当前的测试覆盖是否充分
- 补充最终结果做验收的端到端测试 SPEC.md
- 出具有事实依据的验收结果报告

- 生成一个 html，给我讲解这个项目的结构，和他们之间的关系