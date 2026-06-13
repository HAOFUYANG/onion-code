---
name: efficiency-report
description: 效能度量分析报告生成器。当用户提到"效能度量"、"研发效能"、"效率分析"、"效能报告"、"engineering efficiency"、"team metrics"、"研发度量"、"交付效能"、"团队绩效"等，或者给出一份 Excel/CSV 格式的效能数据要求分析时，必须使用此技能。即使只是简单说"分析一下这个表"、"帮我看看这个数据"、"生成报告"、"做个报表"、"生成数据报表"也应触发。本技能专门处理从数据读取→分析→对标→生成HTML报告的全流程，不依赖外部服务。如果用户打开一个包含效能数据的文件并要求分析，优先使用本技能。
---

# 效能度量分析报告生成器

## 设计意图

本技能的目标是将杂乱原始的效能数据转化为有洞察、有结论、有行动建议的结构化分析报告。核心价值不是"展示数据"（用户自己也会看表），而是**提炼数据背后的故事**——哪些指标好、哪些差、趋势如何、风险在哪、下一步该做什么。

最终输出是一个可直接在浏览器中打开的 **HTML 文件**（带样式、图表可视化），保存到用户桌面或指定路径。

## 核心流程

> **执行约束：所有 Python 代码必须通过 `run_py` 工具内联执行，禁止先用 `write_file` 写脚本再用 `exec` 执行。`run_py` 会自动处理临时文件并清理，不会留下任何文件。**
>
> **HTML 文件的写入使用 `write_file` 工具，这是唯一允许的文件写入操作（因为这是用户期望的产出物）。**

### Step 1：读取与探索数据

1. 用 `pandas` 读取 Excel（`.xlsx`/`.xls`）或 CSV 文件
2. 输出基本信息：行数、列数、各列数据类型、缺失值情况
3. 自动识别列的类型：
   - **维度列（分类变量）**：如团队、项目、负责人、迭代等文本型/分类列
   - **时间列**：日期类型（datetime）或列名含"日期/时间/月份/周/月/年"等关键词
   - **指标列（数值度量）**：数值型列，待分析的 KPI
4. 展示前几行数据，让用户确认解析正确

> **如果用户没有给出文件路径，主动询问文件位置。** 如果数据读取失败（编码问题、格式问题等），尝试不同编码（utf-8, gbk, latin1）或告知用户问题所在。

### Step 2：多维度分析

根据数据特征自动选择合适的分析方法，不要生搬硬套所有方法——只做有数据支撑的分析。

#### 2.1 汇总统计

对每个指标列计算：均值、中位数、标准差、最大值、最小值、P25/P75 四分位数。用表格呈现。

#### 2.2 对标评估（核心）

将实际指标与行业标准/经典 benchmark 对比，给出评级。

**研发效能经典基准（DORA）**：

| 指标               | Elite    | High              | Medium            | Low          |
| ------------------ | -------- | ----------------- | ----------------- | ------------ |
| 部署频率           | 每日多次 | 每周一次~每日一次 | 每月一次~每周一次 | 每月少于一次 |
| 变更前置时间       | <1小时   | 1天~1周           | 1周~1月           | >6个月       |
| 故障恢复时间(MTTR) | <1小时   | <1天              | <1周              | >6个月       |
| 变更失败率         | <5%      | <10%              | <15%              | >30%         |

**扩展基准（供参考，非 DORA 标准）**：

- **需求交付周期**：<7天 优秀，7-14天 良好，14-30天 一般，>30天 需关注
- **缺陷率**（生产缺陷/交付数）：<1% 优秀，1-3% 良好，3-5% 一般，>5% 需关注
- **代码覆盖率**：>80% 优秀，60-80% 良好，<60% 需加强
- **任务完成率**（完成数/计划数）：>90% 优秀，70-90% 正常，<70% 需关注
- **吞吐量**（人均完成数）：按团队规模和周期评估，无绝对标准时用分位数法分档

**对标原则**：

- 基准只是一个参考坐标系，不是铁律。如果数据含义与基准不完全匹配，说明差异并做**相对评估**（"本数据集内部排名"而非绝对评级）
- 如果数据中没有与上述基准对应的指标，**不要强行对标**。改用分位数法将数据分为"优秀/良好/一般/需关注"四档
- 对于每个对标评估，都要写一句**解读**，说清楚这个评级的实际含义

#### 2.3 趋势分析

如果数据包含时间维度（多个时间点），按时间聚合：

- 计算每个时间窗口的指标均值/总和
- 识别趋势方向：上升/下降/波动/稳定
- 计算环比变化，标注超过 ±20% 的显著拐点
- 用简单文字描述趋势，而不是罗列数字

#### 2.4 分组对比

如果数据包含维度列（如多个团队/项目），按维度分组：

- 计算各组的核心指标均值
- 排名，识别最佳和最差组
- 计算最佳/最差比值，评估组间差距
- 如果某组在多项指标上都垫底，重点标注

#### 2.5 异常检测

- 使用 IQR 法：异常值 = 低于 Q1-1.5×IQR 或高于 Q3+1.5×IQR
- 列出异常值及其对应的维度组合
- 简要分析异常的可能原因（如：某团队某迭代缺陷数异常高——是特殊版本还是流程问题？）

### Step 3：生成 HTML 报告

**这是本 skill 的核心输出**。所有分析数据准备好之后，用 Python 生成一个完整的、自包含的 HTML 文件。

#### 3.1 HTML 报告要求

- **保存路径**：优先保存到用户桌面（`~/Desktop/`），文件名为 `效能分析报告_YYYYMMDD_HHmmss.html`
- **样式内嵌**：所有 CSS 直接写在 HTML 内（`<style>` 标签），不依赖外部 CSS 文件
- **图标库**：使用 Font Awesome CDN（`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css`）渲染图标
- **图表**：使用 Chart.js CDN（`https://cdn.jsdelivr.net/npm/chart.js`）生成可视化图表
- **响应式设计**：适配桌面和移动端浏览
- **中文字体**：使用系统字体栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`

#### 3.2 HTML 结构模板

报告必须包含以下区块，每个区块是一个视觉卡片：

```
┌──────────────────────────────────────────────────┐
│  🏢 标题区                                       │
│  报告标题 + 生成时间 + 数据来源                   │
├──────────────────────────────────────────────────┤
│  📊 数据概览卡片                                  │
│  记录数、团队数、指标数、时间跨度等                │
├──────────────────────────────────────────────────┤
│  🎯 核心指标分析                                  │
│  每个指标一个卡片：                                │
│  ┌────────────────────────────────────────┐      │
│  │ 指标名称 + 评级标签(Elite/High/...)    │      │
│  │ 实际值  |  对标评级  |  解读            │      │
│  └────────────────────────────────────────┘      │
├──────────────────────────────────────────────────┤
│  📈 图表区                                       │
│  - 团队对比柱状图（关键指标横向对比）              │
│  - 趋势折线图（如有时间序列数据）                  │
├──────────────────────────────────────────────────┤
│  🏆 分组对比                                     │
│  排名表格 + 解读                                  │
├──────────────────────────────────────────────────┤
│  ⚠️ 异常与风险                                    │
│  异常值列表 + 风险点                              │
├──────────────────────────────────────────────────┤
│  📝 综合结论                                     │
│  亮点 ✅  |  待改进 ⚠️  |  改进建议 💡             │
└──────────────────────────────────────────────────┘
```

#### 3.3 生成方式

用 Python 代码构建 HTML 字符串，用 `write_file` 写入文件。示例框架：

```python
import pandas as pd
import numpy as np
from datetime import datetime
import os

# ... 前面分析代码 ...

# 构建 HTML
html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>效能度量分析报告</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    /* 全局样式 */
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f0f2f5; color: #333; padding: 20px; }}
    .container {{ max-width: 1200px; margin: 0 auto; }}
    
    /* 卡片样式 */
    .card {{ background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
    .card-title {{ font-size: 20px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }}
    .card-title i {{ color: #1890ff; }}
    
    /* 头部 */
    .header {{ text-align: center; padding: 40px 24px; background: linear-gradient(135deg, #1890ff, #096dd9); color: #fff; border-radius: 12px; margin-bottom: 20px; }}
    .header h1 {{ font-size: 28px; margin-bottom: 8px; }}
    .header .meta {{ font-size: 14px; opacity: 0.85; }}
    
    /* 概览网格 */
    .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }}
    .stat-item {{ text-align: center; padding: 16px; background: #fafafa; border-radius: 8px; }}
    .stat-item .value {{ font-size: 28px; font-weight: 700; color: #1890ff; }}
    .stat-item .label {{ font-size: 13px; color: #666; margin-top: 4px; }}
    
    /* 评级标签 */
    .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }}
    .badge-elite {{ background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }}
    .badge-high {{ background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; }}
    .badge-medium {{ background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }}
    .badge-low {{ background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; }}
    
    /* 指标卡片 */
    .metric-card {{ border-left: 4px solid #1890ff; padding: 16px; margin-bottom: 12px; background: #fafafa; border-radius: 0 8px 8px 0; }}
    .metric-card .metric-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }}
    .metric-card .metric-name {{ font-size: 16px; font-weight: 600; }}
    .metric-card .metric-value {{ font-size: 24px; font-weight: 700; color: #1890ff; }}
    .metric-card .metric-desc {{ font-size: 14px; color: #666; line-height: 1.6; }}
    
    /* 表格 */
    table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
    th {{ background: #fafafa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e8e8e8; }}
    td {{ padding: 12px; border-bottom: 1px solid #f0f0f0; }}
    tr:hover {{ background: #fafafa; }}
    .rank-1 {{ color: #f5222d; font-weight: 700; }}
    .rank-last {{ color: #faad14; font-weight: 700; }}
    
    /* 图表容器 */
    .chart-container {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 12px; }}
    .chart-box {{ padding: 16px; background: #fafafa; border-radius: 8px; }}
    .chart-box h4 {{ text-align: center; margin-bottom: 12px; font-size: 15px; color: #555; }}
    
    /* 异常列表 */
    .risk-item {{ padding: 12px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid; }}
    .risk-critical {{ background: #fff2f0; border-color: #ff4d4f; }}
    .risk-warning {{ background: #fffbe6; border-color: #faad14; }}
    .risk-info {{ background: #e6f7ff; border-color: #1890ff; }}
    
    /* 结论区 */
    .conclusion-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }}
    .highlight {{ padding: 16px; border-radius: 8px; }}
    .highlight-good {{ background: #f6ffed; border: 1px solid #b7eb8f; }}
    .highlight-bad {{ background: #fff2f0; border: 1px solid #ffccc7; }}
    .highlight-tip {{ background: #e6f7ff; border: 1px solid #91d5ff; }}
    .highlight h4 {{ font-size: 15px; margin-bottom: 8px; }}
    .highlight ul {{ padding-left: 20px; font-size: 14px; line-height: 1.8; }}
    
    @media (max-width: 768px) {{ 
      .chart-container {{ grid-template-columns: 1fr; }} 
      .stats-grid {{ grid-template-columns: repeat(2, 1fr); }}
      .conclusion-grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <h1><i class="fas fa-chart-line"></i> 效能度量分析报告</h1>
      <div class="meta">
        <i class="fas fa-calendar-alt"></i> 生成时间：{now} &nbsp;|&nbsp; 
        <i class="fas fa-file-excel"></i> 数据来源：{filename} &nbsp;|&nbsp; 
        <i class="fas fa-database"></i> 共 {num_records} 条记录
      </div>
    </div>
    <!-- 数据概览 -->
    ...
    <!-- 核心指标 -->
    ...
    <!-- 图表 -->
    ...
    <!-- 对比排名 -->
    ...
    <!-- 风险异常 -->
    ...
    <!-- 结论 -->
    ...
  </div>
  <script>
    // Chart.js 图表
    ...
  </script>
</body>
</html>"""

# 写入文件
output_path = os.path.expanduser("~/Desktop/效能分析报告_{datetime.now():%Y%m%d_%H%M%S}.html")
# 用 write_file 工具写入
```

#### 3.4 图表生成原则

使用 Chart.js 生成以下图表（有数据就画，没数据跳过）：

1. **团队对比柱状图（bar chart）**：各团队在关键指标（缺陷率、完成率、覆盖率、交付周期）上的横向对比。多个指标用不同颜色区分。
2. **趋势折线图（line chart）**：如果有时间序列数据，展示关键指标随迭代的变化趋势。标注显著拐点。
3. **缺陷率分布图**（可选）：如果数据量合适，展示各团队的缺陷率分布。

颜色方案：
- 缺陷率（越小越好）：用红色系，反向显示（越低越绿）
- 完成率/覆盖率（越大越好）：用蓝色/绿色系
- 交付周期（越小越好）：用橙色系

#### 3.5 评级标签颜色规则

| 评级 | 标签类名 | 颜色 |
| --- | --- | --- |
| Elite / 优秀 | `badge-elite` | 绿色 |
| High / 良好 | `badge-high` | 蓝色 |
| Medium / 一般 | `badge-medium` | 黄色 |
| Low / 需关注 | `badge-low` | 红色 |

### Step 4：展示与解释

HTML 文件生成后，执行以下操作：

1. 用 `exec` 执行 `open` 命令打开该 HTML 文件（Mac 上 `open <filepath>`）
2. 在对话中给用户一句总结性的话，包含文件路径信息
3. 询问：
   - 是否需要调整分析维度或指标重新生成？
   - 是否需要针对某个指标做深入钻取分析？

## 重要原则

### 诚实至上（Honesty Setting: 90%）

如果数据不足以得出结论，直接说"数据不足以判断"，不要强行编造结论。如果某个指标没有行业基准可以参考，就说"暂无行业标准对标，仅展示本数据内部的相对表现"。宁可诚实地说"不知道"，也不要给出误导性的分析。

### 有洞察，不堆数字

报告的价值在于"所以呢？"——每个数据点都要给出解读。不要说"部署频率平均为每天2次"，要说"部署频率平均为每天2次，达到 DORA Elite 标准，说明团队的 DevOps 实践成熟度较高，建议保持并分享经验"。

### 保持客观

区分"事实"和"解读"。事实是"缺陷率为 3.5%"，解读是"处于良好和需关注的临界点"。同时给出正反两面——好的地方肯定，差的地方指出但不苛责。

### 适应性

如果用户的 Excel 结构与你预期的不同（比如不是标准研发效能数据），不要强行套用 DORA 框架。退而求其次，做基于数据本身的描述性统计分析，并提供专业观察。**灵活性比死板执行更重要。**

### HTML 质量

生成的 HTML 必须是一个**完整、自包含、可直接打开浏览**的网页文件。它应该让用户感觉这是一份"专业的分析报告"，而不是粘贴了数据的页面。花时间在 CSS 样式和排版上——良好的视觉呈现本身就是洞察的一部分。
