# 实施计划：修复 Next.js 16.1.1 Middleware 冲突

## 问题诊断

**构建错误**：
```
Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected.
Please use "./proxy.ts" only.
```

**根本原因**：
- Next.js 16.1.1 检测到根目录同时存在 `middleware.ts` 和 `proxy.ts`
- 两个文件内容相同，但导出函数名不同：
  - `middleware.ts` 导出 `middleware` 函数（符合约定）
  - `proxy.ts` 导出 `proxy` 函数（不符合约定）
- Vercel 构建期触发多入口冲突检测

## 实施方案（方案 A）

**核心操作**：删除 `middleware.ts`，将 `proxy.ts` 重命名为 `middleware.ts`，修改导出函数名

---

## 详细步骤

### 步骤 1：删除冲突文件

**操作**：
```bash
git rm middleware.ts
```

**说明**：删除旧的 `middleware.ts`，消除文件冲突源

---

### 步骤 2：重命名 proxy.ts

**操作**：
```bash
git mv proxy.ts middleware.ts
```

**说明**：将 `proxy.ts` 重命名为符合 Next.js 约定的 `middleware.ts`

---

### 步骤 3：修改导出函数名

**文件**：`middleware.ts`（原 `proxy.ts`）

**修改位置**：第 79 行

**变更内容**：
```diff
- export async function proxy(request: NextRequest) {
+ export async function middleware(request: NextRequest) {
```

**保持不变**：
- 第 110-112 行的 `export const config = { matcher: "/:path*" }`
- 所有认证逻辑（Basic Auth、Cookie、重定向）

---

## 验证步骤

### 本地验证

1. **构建验证**
   ```bash
   pnpm build
   ```
   预期：不再出现 middleware 冲突错误

2. **运行验证**
   ```bash
   pnpm dev
   ```
   验证点：
   - 访问受保护页面应跳转到 `/login`
   - 登录后写入 `dashboard_auth` cookie
   - 白名单路径不被拦截：`/_next/*`、`/api/sync*`、`/favicon.ico`、`/login`、`/api/auth*`

### Vercel 部署验证

1. **清理构建缓存**（必须）
   - 在 Vercel 项目设置中执行 **Clear Build Cache**

2. **重新部署**
   - 推送代码触发自动部署或手动触发部署

3. **检查构建日志**
   - 确认无 middleware 冲突错误

4. **运行时验证**
   - 确认环境变量 `CLIPROXY_SECRET_KEY` / `PASSWORD` 已配置
   - 测试登录流程完整性

---

## 风险控制

### 潜在风险

1. **Windows 大小写不敏感**：重命名可能导致文件残留
2. **Vercel 缓存**：旧构建产物可能被复用

### 缓解措施

1. **两步法重命名**（如遇问题）
   ```bash
   git mv proxy.ts middleware.tmp.ts
   git mv middleware.tmp.ts middleware.ts
   ```

2. **Vercel 必做操作**
   - 部署前 **Clear Build Cache**

### 回滚方案

**使用 Git 回滚**：
```bash
git restore middleware.ts proxy.ts
```

**手动回滚**：
- 恢复备份的 `middleware.ts` 和 `proxy.ts`（操作前建议备份）

---

## 技术细节

### 文件变更清单

| 操作 | 文件 | 变更内容 |
|------|------|----------|
| 删除 | `middleware.ts` | 整文件删除 |
| 重命名 | `proxy.ts` → `middleware.ts` | 文件名变更 |
| 修改 | `middleware.ts:79` | `export async function proxy` → `export async function middleware` |

### 保持不变

- `config.matcher = "/:path*"`（第 110-112 行）
- 所有认证逻辑（Basic Auth、Cookie SHA-256、重定向）
- 白名单路径判断逻辑

---

## 预期结果

✅ Vercel 构建成功，无 middleware 冲突错误
✅ 认证功能正常，登录流程完整
✅ 白名单路径正确放行
✅ Cookie 续期逻辑正常工作

---

## 后续优化建议（可选）

1. **添加单元测试**：覆盖 middleware 认证逻辑
2. **环境变量校验**：在构建期检查必需环境变量
3. **监控告警**：跟踪认证失败率和重定向异常

---

**计划制定时间**：2026-01-18
**负责人**：Codex（后端架构）+ Claude（编排）
**SESSION_ID**：019bd04a-154b-78c0-903a-0ee3444dfd60
