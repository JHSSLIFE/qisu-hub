/**
 * 登录方式注册表
 * 当前仅两种：成员用「用户名 + 密码」，外部专家用「专家邀请码」。
 * 凭据均由管理员在平台侧生成，本文件只描述入口展示与标识，不包含生成逻辑。
 */

export type AuthMethodId = 'password' | 'expert';

export type AuthMethodStage = 'active' | 'planned';

export type AuthPriority = 'P0' | 'P1';

export interface AuthMethodConfig {
  /** 稳定标识：用于 data 属性、埋点与后续路由 */
  id: AuthMethodId;
  /** 登录页分段控件上的短标签 */
  short: string;
  /** 完整名称 */
  label: string;
  stage: AuthMethodStage;
  priority: AuthPriority;
  /** 一句话说明 */
  summary: string;
  /** 表单下方说明 */
  detail: string;
  /** 凭据来源，便于排期与支持排查 */
  requires: string;
}

export const AUTH_METHODS: AuthMethodConfig[] = [
  {
    id: 'password',
    short: '成员登录',
    label: '用户名 + 密码',
    stage: 'active',
    priority: 'P0',
    summary: '内部成员使用管理员分配的账号登录',
    detail: '账号由管理员在平台侧生成；首次登录后可在此设备保持 30 天。',
    requires: '管理员已分配用户名与初始密码',
  },
  {
    id: 'expert',
    short: '专家邀请码',
    label: '专家邀请码',
    stage: 'active',
    priority: 'P0',
    summary: '外部专家用邀请码进入被授权的空间',
    detail: '邀请码一次性发放、有有效期；进入后仅能看到该空间内授权给你的内容。',
    requires: '管理员已发放专家邀请码',
  },
];

/** 默认展示的登录方式：成员登录，覆盖绝大多数使用场景 */
export const DEFAULT_AUTH_METHOD: AuthMethodId = 'password';

export const authMethodById = (id: AuthMethodId): AuthMethodConfig =>
  AUTH_METHODS.find(method => method.id === id) ?? AUTH_METHODS[0];

export const activeAuthMethods = (): AuthMethodConfig[] =>
  AUTH_METHODS.filter(method => method.stage === 'active');
