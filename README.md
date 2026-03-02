# Coze Workflow Backend

扣子工作流后端服务 - 支持多工作流调用

## 功能

- 多工作流管理
- 流式响应
- 认证管理

## 安装

```bash
npm install
```

## 配置

1. 复制示例配置文件：
```bash
cp workflows.json.example workflows.json
```

2. 编辑 `workflows.json` 填入你的工作流配置和 Token

## 运行

```bash
npm start
```

## API 接口

- `GET /api/health` - 健康检查
- `GET /api/workflows` - 获取工作流列表
- `POST /api/workflow/run` - 调用工作流
