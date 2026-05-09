# 菜单助手（Menu Maker）技术设计文档

**版本**: 1.0  
**日期**: 2026-05-09

---

## 1. 项目概述

一个帮助家庭解决"今天吃什么"问题的 Web 应用。用户录入采购的食材库存，应用基于当前库存通过 AI 推荐中饭和晚饭菜品，选定菜品后自动扣除相应食材用量，并附带来自成熟菜谱平台的参考链接和完整做法。

### 核心价值

- 减少"不知道做什么菜"的决策负担
- 合理利用冰箱库存，减少食材浪费
- 全家共用同一份库存，多端同步

---

## 2. 技术架构

### 2.1 技术栈

| 层级      | 技术选型                 | 说明                 |
| --------- | ------------------------ | -------------------- |
| 前端框架  | Next.js 15 (App Router)  | 全栈框架，前后端一体 |
| UI 组件库 | shadcn/ui + Tailwind CSS | 移动端友好，快速开发 |
| 数据库    | Supabase (PostgreSQL)    | 云端存储，多设备同步 |
| 认证      | Supabase Auth            | 共用家庭账号         |
| AI 服务   | DeepSeek API             | 菜品推荐和菜谱生成   |
| 部署      | Vercel                   | 与 Next.js 无缝集成  |
| 状态管理  | Zustand                  | 轻量客户端状态       |

### 2.2 架构图

```
┌─────────────────────────────────────────────┐
│                  用户设备                    │
│         (手机 / 平板 / PC 浏览器)            │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│             Next.js (Vercel)                │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │   App Router     │  │   API Routes    │  │
│  │   (页面渲染)     │  │   (后端接口)    │  │
│  └──────────────────┘  └────────┬────────┘  │
└───────────────────────────────┬─┼───────────┘
                                │ │
               ┌────────────────┘ └──────────────┐
               │                                 │
┌──────────────▼──────┐              ┌───────────▼────────┐
│      Supabase        │              │    DeepSeek API    │
│  (PostgreSQL + Auth) │              │   (AI 菜品推荐)    │
└──────────────────────┘              └────────────────────┘
```

---

## 3. 数据库设计（Supabase）

### 3.1 表结构

#### `dish_categories` — 菜品分类

```sql
CREATE TABLE dish_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,   -- "中餐"、"白人饭"、"日料" 等
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 初始数据
INSERT INTO dish_categories (name, sort_order) VALUES
  ('中餐', 1), ('西餐', 2), ('日料', 3), ('快手菜', 4);
```

#### `ingredients` — 食材定义

```sql
CREATE TABLE ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,   -- "鸡蛋"、"西红柿"
  unit        TEXT NOT NULL,          -- "个"、"克"、"毫升"、"根"
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

#### `inventory` — 当前库存

```sql
CREATE TABLE inventory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity       DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- 当前剩余数量
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ingredient_id)
);
```

#### `meal_sessions` — 每次 AI 生成记录

```sql
CREATE TABLE meal_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note          TEXT,                -- 用户的额外要求，如"不想吃辣"
  inventory_snapshot JSONB,         -- 生成时的库存快照（用于回溯）
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

#### `meal_recommendations` — AI 推荐的菜品

```sql
CREATE TABLE meal_recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES meal_sessions(id) ON DELETE CASCADE,
  meal_type       TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  dish_name       TEXT NOT NULL,
  category_id     UUID REFERENCES dish_categories(id),
  description     TEXT,             -- 一句话描述这道菜
  cooking_steps   TEXT,             -- 完整做法（Markdown 格式）
  ingredients_used JSONB NOT NULL,  -- [{"name":"鸡蛋","quantity":2,"unit":"个"}, ...]
  reference_links JSONB,            -- [{"platform":"下厨房","url":"...","title":"..."}, ...]
  is_selected     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### `inventory_logs` — 库存变动日志

```sql
CREATE TABLE inventory_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id        UUID NOT NULL REFERENCES ingredients(id),
  change_amount        DECIMAL(10, 2) NOT NULL,  -- 正数=增加，负数=扣除
  change_type          TEXT NOT NULL CHECK (change_type IN ('purchase', 'cook', 'manual', 'expire')),
  recommendation_id    UUID REFERENCES meal_recommendations(id),
  note                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Row Level Security（RLS）

由于全家共用一个 Supabase 账号，所有表对已认证用户开放读写：

```sql
-- 对所有表启用 RLS，但对认证用户全放行
ALTER TABLE dish_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- 示例（所有表同样配置）
CREATE POLICY "authenticated_all" ON dish_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 4. 功能模块设计

### 4.1 模块列表

```
App
├── 首页 /                  → 今日推荐入口
├── 推荐 /recommend         → AI 生成菜品推荐
├── 库存 /inventory         → 食材库存管理
│   ├── 列表/编辑
│   └── 添加食材
├── 分类 /categories        → 菜品分类管理
└── 历史 /history           → 历史生成记录
```

### 4.2 各模块详细功能

#### 模块 A：首页（Dashboard）

- 展示今日已选菜品（午饭 / 晚饭）
- 显示库存预警（数量为 0 的食材高亮）
- 快捷入口：「生成今日菜单」按钮
- 显示近 3 天用餐历史

#### 模块 B：菜品推荐

**生成流程：**

1. 用户可选填备注（如"不吃辣"、"今天想吃清淡的"）
2. 可筛选菜品分类（默认不限）
3. 点击「生成菜单」，调用后端 API
4. AI 同时为午饭和晚饭各推荐 3 道候选菜
5. 每道菜展示：名称、分类标签、简介、所需食材及用量
6. 用户可对同一餐次「换一批」（重新请求，不影响另一餐）
7. 点击菜品卡片可展开：完整做法、参考链接列表

**选定菜品流程：**

1. 点击「选这个」
2. 弹出确认弹窗，展示将扣除的食材清单
3. 支持对每种食材手动修改扣除量（默认为推荐量）
4. 确认后扣除库存，记录到 `inventory_logs`

**参考链接展示：**

- 每道菜附带 2-4 个平台搜索链接（下厨房、Bilibili、YouTube、AllRecipes）
- 链接格式为对应平台的搜索页，确保有效性
- 有视频平台标注「视频」图标，菜谱平台标注「图文」图标

#### 模块 C：库存管理

- 以列表形式展示所有食材及当前数量
- 支持搜索/按类别筛选（蔬菜、肉类、调料等）
- 每行可直接点击数量进行编辑（inline edit）
- 支持添加新食材：名称、单位
- 支持删除食材（若有关联库存记录提示确认）
- 查看某食材的库存变动日志

#### 模块 D：分类管理

- 展示当前所有菜品分类
- 支持新增、重命名、删除分类
- 支持拖拽排序（调整显示顺序）
- 删除时若有关联推荐记录，仅取消关联不级联删除

#### 模块 E：历史记录

- 按日期分组展示历史生成的菜单 session
- 每个 session 显示：生成时间、备注、推荐菜品列表、哪些被选中
- 支持查看当时的完整做法

---

## 5. API 接口设计

所有接口路径前缀：`/api`

### 5.1 认证

| 方法 | 路径               | 说明         |
| ---- | ------------------ | ------------ |
| POST | `/api/auth/login`  | 邮箱密码登录 |
| POST | `/api/auth/logout` | 退出登录     |

### 5.2 分类管理

| 方法   | 路径                      | 说明                  |
| ------ | ------------------------- | --------------------- |
| GET    | `/api/categories`         | 获取所有分类          |
| POST   | `/api/categories`         | 新增分类              |
| PATCH  | `/api/categories/:id`     | 修改分类（名称/排序） |
| DELETE | `/api/categories/:id`     | 删除分类              |
| POST   | `/api/categories/reorder` | 批量更新排序          |

### 5.3 食材与库存

| 方法   | 路径                                | 说明                           |
| ------ | ----------------------------------- | ------------------------------ |
| GET    | `/api/ingredients`                  | 获取所有食材定义               |
| POST   | `/api/ingredients`                  | 新增食材（同时初始化库存为 0） |
| PATCH  | `/api/ingredients/:id`              | 修改食材名称/单位              |
| DELETE | `/api/ingredients/:id`              | 删除食材                       |
| GET    | `/api/inventory`                    | 获取当前完整库存               |
| PATCH  | `/api/inventory/:ingredientId`      | 手动修改某食材库存数量         |
| POST   | `/api/inventory/purchase`           | 批量录入采购（增加库存）       |
| GET    | `/api/inventory/:ingredientId/logs` | 获取食材变动日志               |

**请求示例 — 批量录入采购：**

```json
POST /api/inventory/purchase
{
  "items": [
    { "ingredientId": "uuid-1", "quantity": 10 },
    { "ingredientId": "uuid-2", "quantity": 500 }
  ],
  "note": "2026-05-09 超市采购"
}
```

### 5.4 AI 菜品推荐

| 方法 | 路径                      | 说明                      |
| ---- | ------------------------- | ------------------------- |
| POST | `/api/meals/generate`     | 生成一次推荐（午饭+晚饭） |
| POST | `/api/meals/regenerate`   | 重新生成指定餐次（午/晚） |
| POST | `/api/meals/select`       | 选定菜品并扣除食材        |
| GET  | `/api/meals/sessions`     | 获取历史 session 列表     |
| GET  | `/api/meals/sessions/:id` | 获取单个 session 详情     |

**请求示例 — 生成推荐：**

```json
POST /api/meals/generate
{
  "note": "今天不想吃辣，想吃清淡一点",
  "categoryIds": ["uuid-cat-1", "uuid-cat-2"],  // 可选，不传则不限
  "targetMeals": ["lunch", "dinner"]             // 或只传 ["lunch"]
}
```

**响应示例：**

```json
{
  "sessionId": "uuid-session",
  "lunch": [
    {
      "id": "uuid-rec-1",
      "dishName": "西红柿炒鸡蛋",
      "category": { "id": "uuid", "name": "中餐" },
      "description": "家常经典，酸甜可口，营养均衡",
      "ingredientsUsed": [
        { "name": "西红柿", "quantity": 2, "unit": "个" },
        { "name": "鸡蛋", "quantity": 3, "unit": "个" }
      ],
      "cookingSteps": "## 做法\n1. 西红柿切块...\n2. 鸡蛋打散...",
      "referenceLinks": [
        {
          "platform": "下厨房",
          "title": "搜索「西红柿炒鸡蛋」",
          "url": "https://www.xiachufang.com/search/?keyword=西红柿炒鸡蛋",
          "type": "article"
        },
        {
          "platform": "Bilibili",
          "title": "搜索「西红柿炒鸡蛋做法」",
          "url": "https://search.bilibili.com/all?keyword=西红柿炒鸡蛋做法",
          "type": "video"
        }
      ]
    }
  ],
  "dinner": [ ... ]
}
```

**请求示例 — 选定菜品：**

```json
POST /api/meals/select
{
  "recommendationId": "uuid-rec-1",
  "deductions": [
    { "ingredientId": "uuid-ingredient-1", "quantity": 2 },  // 可覆盖默认量
    { "ingredientId": "uuid-ingredient-2", "quantity": 3 }
  ]
}
```

---

## 6. AI Prompt 设计

### 6.1 系统 Prompt

```
你是一位专业的家庭厨师顾问。用户会告诉你当前冰箱里的食材库存，
你需要根据库存推荐适合的菜品。

要求：
- 优先使用库存中数量充足的食材
- 推荐的菜品要营养搭配合理，午饭和晚饭不重复
- 做法描述要清晰、实用，适合家庭烹饪水平
- 必须严格按照 JSON 格式输出，不要有多余内容

可用菜品分类：{{categories}}
```

### 6.2 用户 Prompt 模板

```
当前食材库存：
{{inventory_list}}

请为今天推荐：
- 午饭：3 道候选菜
- 晚饭：3 道候选菜

额外要求：{{user_note}}

请按以下 JSON 格式输出：
{
  "lunch": [ { "dishName": "", "categoryName": "", "description": "",
               "ingredientsUsed": [{"name":"","quantity":0,"unit":""}],
               "cookingSteps": "" } ],
  "dinner": [ ... ]
}
```

### 6.3 参考链接生成策略

参考链接在后端通过菜名拼接生成，不依赖 AI（避免幻觉）：

```typescript
function buildReferenceLinks(dishName: string) {
  const encoded = encodeURIComponent(dishName);
  return [
    {
      platform: "下厨房",
      title: `搜索「${dishName}」`,
      url: `https://www.xiachufang.com/search/?keyword=${encoded}`,
      type: "article",
    },
    {
      platform: "Bilibili",
      title: `搜索「${dishName} 做法」`,
      url: `https://search.bilibili.com/all?keyword=${encoded}做法`,
      type: "video",
    },
    {
      platform: "YouTube",
      title: `搜索「${dishName} recipe」`,
      url: `https://www.youtube.com/results?search_query=${encoded}+recipe`,
      type: "video",
    },
    {
      platform: "美食杰",
      title: `搜索「${dishName}」`,
      url: `https://www.meishij.net/search.php?keyword=${encoded}`,
      type: "article",
    },
  ];
}
```

---

## 7. 项目结构

```
menu-maker/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx            # 主布局（底部导航栏）
│   │   ├── page.tsx              # 首页 Dashboard
│   │   ├── recommend/
│   │   │   ├── page.tsx          # 推荐主页面
│   │   │   └── [sessionId]/      # 历史 session 详情
│   │   ├── inventory/
│   │   │   ├── page.tsx          # 库存列表
│   │   │   └── purchase/page.tsx # 录入采购
│   │   ├── categories/
│   │   │   └── page.tsx          # 分类管理
│   │   └── history/
│   │       └── page.tsx          # 历史记录
│   └── api/
│       ├── auth/
│       ├── categories/
│       ├── ingredients/
│       ├── inventory/
│       └── meals/
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── dish-card.tsx             # 菜品卡片
│   ├── ingredient-row.tsx        # 库存行
│   ├── deduction-dialog.tsx      # 扣除确认弹窗
│   ├── bottom-nav.tsx            # 移动端底部导航
│   └── inventory-badge.tsx       # 库存预警徽标
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # 浏览器端 client
│   │   └── server.ts             # 服务端 client
│   ├── deepseek.ts               # DeepSeek API 封装
│   ├── prompts.ts                # Prompt 模板
│   └── reference-links.ts        # 参考链接生成
├── stores/
│   └── inventory-store.ts        # Zustand 客户端缓存
├── types/
│   └── index.ts                  # TypeScript 类型定义
└── supabase/
    └── migrations/               # 数据库迁移文件
```

---

## 8. UI/UX 设计规范

### 8.1 移动端适配

- 使用 Tailwind 的响应式前缀（`sm:`, `md:`）
- 底部固定导航栏（首页 / 推荐 / 库存 / 更多）
- 触控友好：按钮最小点击区域 44x44px
- 列表支持下拉刷新（通过重新 fetch 实现）

### 8.2 页面布局

**移动端底部导航：**

```
[🏠 首页] [🤖 推荐] [📦 库存] [⋯ 更多]
```

**推荐页面卡片布局：**

```
┌─────────────────────────────┐
│ 🍱 午饭推荐                  │
├─────────────────────────────┤
│ [西红柿炒鸡蛋] [中餐]        │
│ 家常经典，酸甜可口...         │
│ 需要：西红柿×2 鸡蛋×3        │
│ [查看做法 ▼] [选这个 ✓]      │
├─────────────────────────────┤
│ [红烧肉]  [中餐]             │
│ ...                         │
├─────────────────────────────┤
│        [换一批 🔄]           │
└─────────────────────────────┘
```

### 8.3 关键交互

| 场景         | 交互方式                         |
| ------------ | -------------------------------- |
| 修改库存数量 | 点击数字直接编辑（inline input） |
| 查看做法     | 卡片内展开折叠（accordion）      |
| 确认扣除     | 底部弹出抽屉（bottom sheet）     |
| 添加食材     | 底部弹出表单                     |
| 分类排序     | 长按拖拽                         |
| 换一批推荐   | 按钮点击 + loading 状态          |

---

## 9. 环境变量

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 仅服务端使用

# DeepSeek
DEEPSEEK_API_KEY=               # 仅服务端使用，不暴露给前端
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

---

## 10. 安全考虑

1. **API Key 保护**: DeepSeek API Key 只在 Next.js Server 端（API Routes）使用，不暴露给浏览器
2. **Supabase RLS**: 所有表启用 Row Level Security，只有认证用户可操作
3. **输入验证**: 所有 API 入参使用 Zod 校验，防止非法数据写入
4. **AI 响应处理**: DeepSeek 返回的 JSON 需做格式校验，避免解析错误导致 crash
5. **库存数量下限**: 扣除时检查库存不能低于 0，防止出现负数库存

---

## 11. 开发阶段规划

### Phase 1 — 核心骨架（约 3 天）

- [x] Next.js 项目初始化 + Supabase 连接
- [ ] 数据库 migration 脚本
- [ ] 登录页面 + Supabase Auth 集成
- [ ] 底部导航布局

### Phase 2 — 库存管理（约 2 天）

- [ ] 食材列表页面（查看、编辑数量）
- [ ] 添加食材（名称、单位）
- [ ] 录入采购（批量增加库存）
- [ ] 库存变动日志

### Phase 3 — AI 推荐（约 3 天）

- [ ] DeepSeek API 封装
- [ ] 推荐生成 API（/api/meals/generate）
- [ ] 推荐页面：午饭/晚饭卡片、展开做法、参考链接
- [ ] 「换一批」功能
- [ ] 选定菜品 + 扣除弹窗

### Phase 4 — 分类与历史（约 1 天）

- [ ] 分类管理页面（增删改排序）
- [ ] 历史记录页面

### Phase 5 — 完善（约 1 天）

- [ ] 首页 Dashboard
- [ ] 移动端细节优化
- [ ] 错误处理和 Loading 状态完善
- [ ] 部署到 Vercel

---

## 12. 待确认事项（已解决）

| 问题     | 结论                                 |
| -------- | ------------------------------------ |
| 技术栈   | Next.js 15                           |
| AI 接口  | DeepSeek API（用户自提供 Key）       |
| 数据来源 | AI 生成菜谱 + 程序化生成参考搜索链接 |
| 数据存储 | Supabase（云端 PostgreSQL）          |
| 多用户   | 全家共用同一 Supabase 账号           |
| 登录方式 | 邮箱密码（Supabase Auth）            |
