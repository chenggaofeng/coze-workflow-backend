const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const authManager = require('./auth-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 扣子 API 配置
const COZE_API_ENDPOINT = 'https://api.coze.cn/v1/workflow/stream_run';

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    workflows: authManager.getAllWorkflows().length
  });
});

/**
 * 获取所有工作流列表
 */
app.get('/api/workflows', (req, res) => {
  try {
    const workflows = authManager.getAllWorkflows();
    res.json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('[API] 获取工作流列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取工作流列表失败'
    });
  }
});

/**
 * 获取单个工作流配置
 */
app.get('/api/workflows/:workflowId', (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflow = authManager.getWorkflowConfig(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: '工作流不存在'
      });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('[API] 获取工作流配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取工作流配置失败'
    });
  }
});

/**
 * 调用工作流（流式响应）
 */
app.post('/api/workflow/run', async (req, res) => {
  try {
    const { workflow_id, parameters } = req.body;

    if (!workflow_id) {
      return res.status(400).json({
        success: false,
        error: '缺少 workflow_id 参数'
      });
    }

    if (!authManager.hasWorkflow(workflow_id)) {
      return res.status(404).json({
        success: false,
        error: '工作流不存在'
      });
    }

    const validation = authManager.validateParameters(workflow_id, parameters);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: validation.errors
      });
    }

    const token = authManager.getTokenForWorkflow(workflow_id);
    if (!token) {
      return res.status(500).json({
        success: false,
        error: '无法获取工作流认证令牌'
      });
    }

    console.log(`[API] 调用工作流: ${workflow_id}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const response = await fetch(COZE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflow_id,
        parameters: parameters || {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] 扣子 API 调用失败: ${response.status} ${errorText}`);
      res.write(`event: error\ndata: ${JSON.stringify({ error: '工作流调用失败', status: response.status })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body;
    reader.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          res.write(`${line}\n`);
        }
      }
    });

    reader.on('end', () => {
      console.log(`[API] 工作流 ${workflow_id} 执行完成`);
      res.end();
    });

    reader.on('error', (error) => {
      console.error(`[API] 流式响应错误:`, error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: '流式响应错误' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('[API] 工作流调用异常:', error);
    res.status(500).json({
      success: false,
      error: '工作流调用异常',
      message: error.message
    });
  }
});

/**
 * 重新加载工作流配置（管理接口）
 */
app.post('/api/admin/reload-workflows', (req, res) => {
  try {
    authManager.reloadWorkflows();
    res.json({
      success: true,
      message: '工作流配置已重新加载',
      workflows: authManager.getAllWorkflows().length
    });
  } catch (error) {
    console.error('[API] 重新加载配置失败:', error);
    res.status(500).json({
      success: false,
      error: '重新加载配置失败'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 扣子工作流服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 已加载工作流数量: ${authManager.getAllWorkflows().length}`);
  console.log(`========================================\n`);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});
