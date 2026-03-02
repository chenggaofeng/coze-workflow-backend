/**
 * 认证管理器模块
 * 负责根据工作流 ID 获取对应的 Token
 */

const fs = require('fs');
const path = require('path');

class AuthManager {
  constructor() {
    this.workflows = [];
    this.loadWorkflows();
  }

  loadWorkflows() {
    try {
      const configPath = path.join(__dirname, 'workflows.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      this.workflows = config.workflows || [];
      console.log(`[AuthManager] 已加载 ${this.workflows.length} 个工作流配置`);
    } catch (error) {
      console.error('[AuthManager] 加载工作流配置失败:', error.message);
      this.workflows = [];
    }
  }

  reloadWorkflows() {
    this.loadWorkflows();
  }

  getTokenForWorkflow(workflowId) {
    const workflow = this.workflows.find(w => w.id === workflowId);
    if (!workflow) {
      console.warn(`[AuthManager] 未找到工作流 ${workflowId} 的配置`);
      return null;
    }
    return workflow.token;
  }

  getWorkflowConfig(workflowId) {
    const workflow = this.workflows.find(w => w.id === workflowId);
    if (!workflow) return null;
    const { token, ...config } = workflow;
    return config;
  }

  getAllWorkflows() {
    return this.workflows.map(({ token, ...workflow }) => workflow);
  }

  hasWorkflow(workflowId) {
    return this.workflows.some(w => w.id === workflowId);
  }

  validateParameters(workflowId, parameters) {
    const workflow = this.workflows.find(w => w.id === workflowId);
    if (!workflow) return { valid: false, errors: ['工作流不存在'] };

    const errors = [];
    const requiredParams = workflow.parameters.filter(p => p.required);

    for (const param of requiredParams) {
      if (!parameters || parameters[param.name] === undefined || parameters[param.name] === '') {
        errors.push(`缺少必填参数: ${param.label || param.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = new AuthManager();
